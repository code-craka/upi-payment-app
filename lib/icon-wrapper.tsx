import React, { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

// Use a generic type to bypass the ForwardRefExoticComponent incompatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LucideIcon = any;

export interface IconWrapperProps extends Omit<LucideProps, 'ref'> {
  icon: LucideIcon;
}

// Main IconWrapper component with proper type handling
export const IconWrapper = forwardRef<SVGSVGElement, IconWrapperProps>(
  ({ icon: Icon, ...props }, ref) => {
    return <Icon {...props} ref={ref} />;
  }
);

IconWrapper.displayName = 'IconWrapper';

// Safe icon renderer that handles type errors gracefully
export const SafeIcon: React.FC<{
  icon: LucideIcon;
  fallback?: React.ReactNode;
} & LucideProps> = ({ icon: IconComponent, fallback = null, ...props }) => {
  try {
    return <IconComponent {...props} />;
  } catch (error) {
    console.warn('Icon rendering failed:', error);
    return <>{fallback}</>;
  }
};

export default IconWrapper;