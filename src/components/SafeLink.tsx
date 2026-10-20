import * as React from 'react';
import { sanitizeHref, isExternalUrl } from '../utils/urlSanitizer';

export interface SafeLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  fallbackHref?: string;
  forceExternal?: boolean;
}

/**
 * Enterprise SafeLink Component
 * Mitigates XSS via dangerous protocol URIs (javascript:, data:, vbscript:)
 * and prevents reverse tab-nabbing attacks on external targets.
 */
export const SafeLink = React.forwardRef<HTMLAnchorElement, SafeLinkProps>(
  ({ href, fallbackHref = '#', forceExternal, target, rel, children, ...props }, ref) => {
    const safeHref = React.useMemo(() => sanitizeHref(href, fallbackHref), [href, fallbackHref]);
    const isExternal = forceExternal || isExternalUrl(href);

    const effectiveTarget = isExternal ? '_blank' : target;
    const effectiveRel = isExternal ? 'noopener noreferrer' : rel;

    return (
      <a
        ref={ref}
        href={safeHref}
        target={effectiveTarget}
        rel={effectiveRel}
        {...props}
      >
        {children}
      </a>
    );
  }
);

SafeLink.displayName = 'SafeLink';

export default SafeLink;
