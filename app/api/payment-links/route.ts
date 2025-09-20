import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { PaymentLinkModel } from '@/lib/db/models/PaymentLink';
import { getUserFromSession } from '@/lib/auth/session-edge';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(sessionCookie.value);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    await connectDB();

    // Admin can view all links, merchants can only view their own
    let query: { createdBy?: string } = {};
    if (user.role === 'admin') {
      if (userId) {
        query.createdBy = userId;
      }
    } else if (user.role === 'merchant') {
      query.createdBy = user.userId;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const paymentLinks = await PaymentLinkModel.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return NextResponse.json({
      success: true,
      data: paymentLinks,
    });
  } catch (error) {
    console.error('Error fetching payment links:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(sessionCookie.value);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'merchant') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      amount,
      allowCustomAmount,
      minAmount,
      maxAmount,
      expiresAt,
      usageLimit,
      customFields,
      settings,
    } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Generate unique link ID
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const paymentLink = new PaymentLinkModel({
      linkId,
      title,
      description,
      amount: allowCustomAmount ? undefined : amount,
      allowCustomAmount: allowCustomAmount || false,
      minAmount: allowCustomAmount ? minAmount : undefined,
      maxAmount: allowCustomAmount ? maxAmount : undefined,
      upiId: process.env.UPI_ID || 'merchant@paytm',
      createdBy: user.userId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      usageLimit,
      customFields: customFields || [],
      settings: {
        collectCustomerInfo: settings?.collectCustomerInfo || true,
        sendEmailReceipt: settings?.sendEmailReceipt || false,
        redirectUrl: settings?.redirectUrl,
        webhookUrl: settings?.webhookUrl,
      },
    });

    await paymentLink.save();

    return NextResponse.json({
      success: true,
      data: paymentLink,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}