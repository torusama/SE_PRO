import { BAZI_DISCLAIMER, BaziRuleService } from './bazi-rule.service';

describe('BaziRuleService', () => {
  const service = new BaziRuleService();

  it('returns a detailed cultural suggestion with full Bazi and Bat Trach calculation', () => {
    const result = service.suggest({
      birthDate: '2006-03-02',
      birthTime: '11:35',
      gender: 'male',
    });

    expect(result.yearPillar).toBe('Bính Tuất');
    expect(result.napAmName).toBe('Ốc Thượng Thổ');
    expect(result.napAmMeaning).toBe('Đất trên mái nhà');
    expect(result.element).toBe('Thổ');
    expect(result.birthHourBranch).toBe('Ngọ');
    expect(result.preferredDirections.length).toBe(4);
    expect(result.goodDirections.length).toBe(4);
    expect(result.badDirections.length).toBe(4);
    expect(result.disclaimer).toBe(BAZI_DISCLAIMER);
    expect(result.detailedAnalysis).toContain('Bát Trạch');
  });

  it('calculates different Cung Mệnh for female and male', () => {
    const maleResult = service.suggest({
      birthDate: '1990-05-15',
      gender: 'male',
    });
    const femaleResult = service.suggest({
      birthDate: '1990-05-15',
      gender: 'female',
    });

    expect(maleResult.yearPillar).toBe('Canh Ngọ');
    expect(femaleResult.yearPillar).toBe('Canh Ngọ');
    expect(maleResult.cungMenh).toBe('Khảm');
    expect(femaleResult.cungMenh).toBe('Cấn');
    expect(maleResult.cungMenh).not.toBe(femaleResult.cungMenh);
  });
});
