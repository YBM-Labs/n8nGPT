'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { CodeBlock, CodeBlockCopyButton } from './code-block';

type ResponseProps = ComponentProps<typeof Streamdown>;

// Enhanced response component that handles code blocks and JSON formatting
export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => {
    const processedContent = useMemo(() => {
      if (typeof children !== 'string') {
        return children;
      }

      // Split content by code blocks (```language ... ```)
      const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
      const parts: (string | { type: 'code'; language: string; code: string })[] = [];
      let lastIndex = 0;
      let match;

      while ((match = codeBlockRegex.exec(children)) !== null) {
        // Add text before code block
        if (match.index > lastIndex) {
          const textPart = children.slice(lastIndex, match.index);
          if (textPart.trim()) {
            parts.push(textPart);
          }
        }

        // Add code block
        const language = match[1] || 'text';
        const code = match[2].trim();
        parts.push({
          type: 'code',
          language,
          code,
        });

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < children.length) {
        const remainingText = children.slice(lastIndex);
        if (remainingText.trim()) {
          parts.push(remainingText);
        }
      }

      // If no code blocks found, check for JSON objects
      if (parts.length === 1 && typeof parts[0] === 'string') {
        const text = parts[0];
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            JSON.parse(jsonMatch[0]);
            // Replace the JSON part with a code block
            const beforeJson = text.slice(0, jsonMatch.index);
            const afterJson = text.slice(jsonMatch.index! + jsonMatch[0].length);
            const newParts: (string | { type: 'code'; language: string; code: string })[] = [];
            
            if (beforeJson.trim()) newParts.push(beforeJson);
            newParts.push({
              type: 'code',
              language: 'json',
              code: jsonMatch[0],
            });
            if (afterJson.trim()) newParts.push(afterJson);
            
            return newParts;
          } catch {
            // Not valid JSON, keep as is
          }
        }
      }

      return parts.length > 0 ? parts : children;
    }, [children]);

    if (typeof processedContent === 'string') {
      return (
        <Streamdown
          className={cn(
            'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
            className
          )}
          {...props}
        >
          {processedContent}
        </Streamdown>
      );
    }

    if (Array.isArray(processedContent)) {
      return (
        <div className={cn('size-full space-y-3', className)}>
          {processedContent.map((part, index) => {
            if (typeof part === 'string') {
              return (
                <Streamdown
                  key={index}
                  className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                >
                  {part}
                </Streamdown>
              );
            }

            if (part.type === 'code') {
              // Pretty format JSON for better readability
              let formattedCode = part.code;
              if (part.language === 'json') {
                try {
                  const parsed = JSON.parse(part.code);
                  formattedCode = JSON.stringify(parsed, null, 2);
                } catch {
                  // If JSON parsing fails, keep original code
                }
              }
              
              return (
                <CodeBlock
                  key={index}
                  code={formattedCode}
                  language={part.language}
                  className="max-w-full overflow-hidden"
                >
                  <CodeBlockCopyButton />
                </CodeBlock>
              );
            }

            return null;
          })}
        </div>
      );
    }

    return (
      <Streamdown
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          className
        )}
        {...props}
      >
        {processedContent}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';
