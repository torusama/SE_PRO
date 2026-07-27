import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { sanitizeAgentDisplayContent } from './agentContent'

interface MarkdownMessageProps {
  content: string
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  const safeContent = sanitizeAgentDisplayContent(content)

  return (
    <div className="agent-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  )
}
