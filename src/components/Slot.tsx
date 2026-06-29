import * as React from 'react';

export const Slot = React.forwardRef<any, any>(({ children, ...props }, ref) => {
  if (!React.isValidElement(children)) {
    return null;
  }

  const child = children as React.ReactElement<any>;
  const childRef = (child as any).ref;

  // Merge style, className, and events
  const mergedClassName = [props.className, child.props.className].filter(Boolean).join(' ');
  const mergedStyle = { ...props.style, ...child.props.style };

  // Combine refs
  const combinedRef = (node: any) => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as any).current = node;
      }
    }
    if (childRef) {
      if (typeof childRef === 'function') {
        childRef(node);
      } else {
        (childRef as any).current = node;
      }
    }
  };

  // Merge handlers
  const mergedProps = { ...props, ...child.props };
  
  // Custom merge for event handlers
  Object.keys(child.props).forEach((key) => {
    if (key.startsWith('on') && typeof child.props[key] === 'function') {
      const parentHandler = props[key];
      const childHandler = child.props[key];
      if (parentHandler) {
        mergedProps[key] = (...args: any[]) => {
          parentHandler(...args);
          childHandler(...args);
        };
      }
    }
  });

  return React.cloneElement(child, {
    ...mergedProps,
    className: mergedClassName,
    style: mergedStyle,
    ref: combinedRef,
  });
});

Slot.displayName = 'Slot';
