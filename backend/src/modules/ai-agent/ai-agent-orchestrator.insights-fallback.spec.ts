import {
  asksForCustomerCare,
  asksForPlotCompetitiveness,
  extractDeterministicRequirements,
} from './ai-agent-orchestrator.service';

describe('AI Agent insight fallbacks', () => {
  it('extracts and normalizes an explicit plot code without an LLM', () => {
    expect(
      extractDeterministicRequirements(
        'Check the internal competitiveness of plot a - 01 - 001.',
      ),
    ).toMatchObject({ selectedPlotCode: 'A-01-001' });
  });

  it.each([
    'Check the internal competitiveness of plot A-01-001.',
    'Kiểm tra mức cạnh tranh của lô A-01-001.',
    'Lô A-01-001 có nhiều người quan tâm không?',
  ])('recognizes a grounded competitiveness request: %s', (message) => {
    expect(asksForPlotCompetitiveness(message)).toBe(true);
  });

  it.each([
    'Show my customer care overview.',
    'Tổng quan chăm sóc tài khoản của tôi.',
    'Kiểm tra lịch hẹn của tôi.',
    'Yêu cầu chuyển nhượng của tôi tới đâu rồi?',
    'Hợp đồng của tôi đã thanh toán chưa?',
    'Tôi có thông báo nào mới không?',
  ])('recognizes an authenticated lifecycle request: %s', (message) => {
    expect(asksForCustomerCare(message)).toBe(true);
  });

  it('does not confuse a normal plot search with competitiveness', () => {
    expect(
      asksForPlotCompetitiveness('Find one plot under 150 million VND.'),
    ).toBe(false);
  });
});
