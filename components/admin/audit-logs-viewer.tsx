'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Download,
  Eye,
  Activity,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { AuditLog } from '@/lib/types';

// Mock data - replace with actual API calls
const mockAuditLogs: AuditLog[] = [
  {
    id: '1',
    action: 'order_verified',
    entityType: 'order',
    entityId: 'ORD-001',
    userId: 'user_123',
    userEmail: 'admin@example.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    metadata: { orderId: 'ORD-001', amount: 1000, previousStatus: 'pending-verification' },
    createdAt: new Date('2024-01-15T10:30:00Z'),
  },
  {
    id: '2',
    action: 'user_created',
    entityType: 'user',
    entityId: 'user_456',
    userId: 'user_123',
    userEmail: 'admin@example.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    metadata: { newUserEmail: 'merchant@example.com', role: 'merchant' },
    createdAt: new Date('2024-01-15T09:15:00Z'),
  },
  {
    id: '3',
    action: 'settings_updated',
    entityType: 'settings',
    entityId: 'upi_timeout',
    userId: 'user_123',
    userEmail: 'admin@example.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    metadata: { key: 'upi_timeout', oldValue: 540, newValue: 600 },
    createdAt: new Date('2024-01-15T08:45:00Z'),
  },
  {
    id: '4',
    action: 'order_utr_submitted',
    entityType: 'order',
    entityId: 'ORD-002',
    userId: 'user_789',
    userEmail: 'customer@example.com',
    ipAddress: '203.0.113.45',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    metadata: { orderId: 'ORD-002', utrNumber: 'UTR123456789' },
    createdAt: new Date('2024-01-15T08:20:00Z'),
  },
  {
    id: '5',
    action: 'login',
    entityType: 'auth',
    entityId: 'session_abc',
    userId: 'user_123',
    userEmail: 'admin@example.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    metadata: { loginMethod: 'email', sessionDuration: 86400 },
    createdAt: new Date('2024-01-15T07:00:00Z'),
  },
];

export function AuditLogsViewer() {
  const [logs, _setLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let filtered = logs;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.ipAddress.includes(searchTerm),
      );
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    // Entity type filter
    if (entityTypeFilter !== 'all') {
      filtered = filtered.filter((log) => log.entityType === entityTypeFilter);
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter((log) => log.createdAt >= filterDate);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, actionFilter, entityTypeFilter, dateRange]);

  const refreshLogs = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: 'Audit logs refreshed',
        description: 'Latest audit logs have been loaded.',
      });
    } catch (_error) {
      toast({
        title: 'Error refreshing logs',
        description: 'Failed to load the latest audit logs.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      // Simulate export
      await new Promise((resolve) => setTimeout(resolve, 500));

      toast({
        title: 'Export started',
        description: "Audit logs are being exported. You'll receive a download link shortly.",
      });
    } catch (_error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export audit logs.',
        variant: 'destructive',
      });
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('login') || action.includes('logout')) {
      return <Shield className="h-4 w-4 text-blue-600" />;
    }
    if (action.includes('created')) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (action.includes('deleted') || action.includes('failed')) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    if (action.includes('updated') || action.includes('verified')) {
      return <Activity className="h-4 w-4 text-orange-600" />;
    }
    return <Clock className="h-4 w-4 text-gray-600" />;
  };

  const getActionBadge = (action: string) => {
    if (action.includes('login') || action.includes('logout')) {
      return (
        <Badge variant="outline" className="border-blue-200 text-blue-600">
          Auth
        </Badge>
      );
    }
    if (action.includes('created')) {
      return (
        <Badge variant="outline" className="border-green-200 text-green-600">
          Create
        </Badge>
      );
    }
    if (action.includes('deleted') || action.includes('failed')) {
      return (
        <Badge variant="outline" className="border-red-200 text-red-600">
          Delete
        </Badge>
      );
    }
    if (action.includes('updated') || action.includes('verified')) {
      return (
        <Badge variant="outline" className="border-orange-200 text-orange-600">
          Update
        </Badge>
      );
    }
    return <Badge variant="outline">Action</Badge>;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getUniqueActions = () => {
    return Array.from(new Set(logs.map((log) => log.action)));
  };

  const getUniqueEntityTypes = () => {
    return Array.from(new Set(logs.map((log) => log.entityType)));
  };

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            Complete activity log with IP tracking and user agent information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search by email, action, entity ID, or IP address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {getUniqueActions().map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {getUniqueEntityTypes().map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={refreshLogs} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" onClick={exportLogs}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({filteredLogs.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="w-[100px]">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                      No audit logs found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action)}
                          <div>
                            <div className="font-medium">
                              {log.action
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </div>
                            {getActionBadge(log.action)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.userEmail}</div>
                          <div className="text-muted-foreground text-sm">{log.userId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.entityType}</div>
                          <div className="text-muted-foreground text-sm">{log.entityId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">{log.ipAddress}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(log.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed View Modal */}
      {selectedLog && (
        <Card className="bg-background fixed inset-4 z-50 overflow-auto border shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {getActionIcon(selectedLog.action)}
                Audit Log Details
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium">Action</Label>
                <div className="bg-muted mt-1 rounded p-2">
                  {selectedLog.action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Timestamp</Label>
                <div className="bg-muted mt-1 rounded p-2">{formatDate(selectedLog.createdAt)}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">User Email</Label>
                <div className="bg-muted mt-1 rounded p-2">{selectedLog.userEmail}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">User ID</Label>
                <div className="bg-muted mt-1 rounded p-2 font-mono text-sm">
                  {selectedLog.userId}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Entity Type</Label>
                <div className="bg-muted mt-1 rounded p-2">{selectedLog.entityType}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">Entity ID</Label>
                <div className="bg-muted mt-1 rounded p-2 font-mono text-sm">
                  {selectedLog.entityId}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">IP Address</Label>
                <div className="bg-muted mt-1 rounded p-2 font-mono text-sm">
                  {selectedLog.ipAddress}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">User Agent</Label>
              <div className="bg-muted mt-1 rounded p-2 text-sm break-all">
                {selectedLog.userAgent}
              </div>
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <Label className="text-sm font-medium">Metadata</Label>
                <div className="bg-muted mt-1 rounded p-2">
                  <pre className="overflow-auto text-sm">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
