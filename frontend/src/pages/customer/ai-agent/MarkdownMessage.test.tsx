import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { sanitizeAgentDisplayContent } from './agentContent'
import MarkdownMessage from './MarkdownMessage'

describe('MarkdownMessage', () => {
  it('renders bold Markdown without showing raw double asterisks', () => {
    render(<MarkdownMessage content="**Ngân sách**: 150 triệu" />)
    expect(screen.getByText('Ngân sách').tagName).toBe('STRONG')
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument()
  })

  it('renders numbered guidance as a readable list', () => {
    render(
      <MarkdownMessage
        content={'1. **Ngân sách**\n2. **Diện tích**\n3. **Vị trí**'}
      />,
    )
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('hides a leaked recommendation tool payload from saved history', () => {
    const content = `Mình đang tìm kiếm các lô phù hợp.

\`\`\`json
{"budgetMax": 60000000, "numberOfPlots": 20}
\`\`\``

    expect(sanitizeAgentDisplayContent(content)).toContain('tối đa 10 lô')
    render(<MarkdownMessage content={content} />)
    expect(screen.queryByText(/budgetMax/)).not.toBeInTheDocument()
    expect(screen.getByText(/tối đa 10 lô/)).toBeInTheDocument()
  })

  it('repairs legacy zone encoding inside assistant prose', () => {
    const content =
      '**Phương án ưu tiên:** D-02-001, thuộc Khu D â€” BÃ¬nh DÃ¢n.'

    expect(sanitizeAgentDisplayContent(content)).toContain('Khu D - Bình dân')
    render(<MarkdownMessage content={content} />)
    expect(screen.getByText(/Khu D - Bình dân/)).toBeInTheDocument()
    expect(screen.queryByText(/Ã|â€”/)).not.toBeInTheDocument()
  })
})
