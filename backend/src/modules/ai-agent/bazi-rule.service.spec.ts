import { BAZI_DISCLAIMER, BaziRuleService } from './bazi-rule.service';

describe('BaziRuleService', () => {
  const service = new BaziRuleService();

  it('returns a detailed cultural Bat Trach suggestion without pretending to be full Bazi', () => {
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
    expect(result.methodology?.scope).toContain('không phải lá số Bát Tự/Tứ Trụ đầy đủ');
    expect(result.limitations?.join(' ')).toContain('Nhật Chủ');
  });

  it('does not let Nap Am element rules contradict favorable Bat Trach directions', () => {
    const result = service.suggest({
      birthDate: '2010-08-12',
      gender: 'male',
    });

    expect(result.yearPillar).toBe('Canh Dần');
    expect(result.napAmName).toBe('Tùng Bách Mộc');
    expect(result.cungMenh).toBe('Cấn');
    expect(result.goodDirections.map((item) => item.direction)).toEqual(
      expect.arrayContaining(['Tây', 'Tây Bắc']),
    );
    expect(result.elementRelations.weakening).toContain('Kim khắc Mộc');
    expect(result.elementRelations.weakening).not.toContain('tránh hướng Tây/Tây Bắc');
    expect(result.detailedAnalysis).toContain('không dùng Nạp Âm để phủ định bảng hướng Bát Trạch');
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
