import React, { useLayoutEffect, useRef } from 'react';

interface AutosizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
}

export const AutosizeTextarea: React.FC<AutosizeTextareaProps> = ({
  minHeight = 34,
  className,
  value,
  ...props
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    node.style.height = 'auto';
    node.style.height = `${Math.max(node.scrollHeight, minHeight)}px`;
  }, [minHeight, value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={className}
      {...props}
    />
  );
};
