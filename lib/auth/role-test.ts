import { roleHasPermission, getPermissionsForRole } from '@/lib/types/roles';

// Test role-based access control
export function testRoleBasedAccess() {
  console.log('🧪 Testing Role-Based Access Control');

  // Test merchant permissions
  const merchantPermissions = getPermissionsForRole('merchant');
  console.log('📋 Merchant permissions:', merchantPermissions);

  // Test specific merchant capabilities
  const canMerchantCreateUsers = roleHasPermission('merchant', 'create_users');
  const canMerchantCreatePayments = roleHasPermission('merchant', 'create_payments');
  const canMerchantViewAllOrders = roleHasPermission('merchant', 'view_all_orders');
  const canMerchantManageSystemSettings = roleHasPermission('merchant', 'manage_system_settings');

  console.log('✅ Merchant can create users:', canMerchantCreateUsers);
  console.log('✅ Merchant can create payments:', canMerchantCreatePayments);
  console.log('❌ Merchant can view all orders:', canMerchantViewAllOrders);
  console.log('❌ Merchant can manage system settings:', canMerchantManageSystemSettings);

  // Test admin permissions (should have all)
  const canAdminManageSystemSettings = roleHasPermission('admin', 'manage_system_settings');
  const canAdminViewAllOrders = roleHasPermission('admin', 'view_all_orders');

  console.log('✅ Admin can manage system settings:', canAdminManageSystemSettings);
  console.log('✅ Admin can view all orders:', canAdminViewAllOrders);

  // Test viewer permissions (should be limited)
  const canViewerCreateUsers = roleHasPermission('viewer', 'create_users');
  const canViewerCreatePayments = roleHasPermission('viewer', 'create_payments');

  console.log('❌ Viewer can create users:', canViewerCreateUsers);
  console.log('❌ Viewer can create payments:', canViewerCreatePayments);

  // Validate merchant role requirements
  const merchantRequirements = {
    canCreateUsers: canMerchantCreateUsers,
    canCreatePayments: canMerchantCreatePayments,
    cannotViewAllOrders: !canMerchantViewAllOrders,
    cannotManageSystem: !canMerchantManageSystemSettings,
  };

  const allMerchantRequirementsMet = Object.values(merchantRequirements).every(Boolean);

  console.log('🎯 Merchant role requirements met:', allMerchantRequirementsMet);
  console.log('📊 Merchant role test results:', merchantRequirements);

  return {
    merchantPermissions,
    merchantRequirements,
    allMerchantRequirementsMet,
  };
}

// Export for use in development/testing
if (typeof window !== 'undefined') {
  // Browser environment - attach to window for manual testing
  (window as unknown as { testRoleBasedAccess: typeof testRoleBasedAccess }).testRoleBasedAccess = testRoleBasedAccess;
}