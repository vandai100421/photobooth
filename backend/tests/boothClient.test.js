const {
  isSystem,
  extractToken,
  extractList,
  normalizeCode,
  normalizeSession,
  pick,
} = require('../src/services/boothClient');

describe('boothClient.isSystem', () => {
  it('nhận đúng 2 hệ thống', () => {
    expect(isSystem('selfbooth')).toBe(true);
    expect(isSystem('photobooth')).toBe(true);
    expect(isSystem('other')).toBe(false);
    expect(isSystem(undefined)).toBe(false);
  });
});

describe('boothClient.pick', () => {
  it('trả giá trị đầu tiên không rỗng', () => {
    expect(pick({ a: '', b: 'x' }, ['a', 'b'])).toBe('x');
    expect(pick({ a: 0 }, ['a'])).toBe(0);
    expect(pick(null, ['a'])).toBeUndefined();
    expect(pick({ a: null, b: null }, ['a', 'b'])).toBeUndefined();
  });
});

describe('boothClient.extractToken', () => {
  it('bóc token ở cấp gốc', () => {
    expect(extractToken({ token: 'abc' })).toBe('abc');
    expect(extractToken({ access_token: 'xyz' })).toBe('xyz');
  });

  it('bóc token lồng trong data/session', () => {
    expect(extractToken({ data: { accessToken: 'nested' } })).toBe('nested');
    expect(extractToken({ session: { jwt: 'deep' } })).toBe('deep');
  });

  it('trả null khi không có token', () => {
    expect(extractToken({ user: 'a' })).toBeNull();
    expect(extractToken(null)).toBeNull();
  });
});

describe('boothClient.extractList', () => {
  it('nhận mảng trực tiếp', () => {
    expect(extractList([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it('nhận mảng lồng trong nhiều key', () => {
    expect(extractList({ data: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    expect(extractList({ items: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(extractList({ vouchers: [{ id: 3 }] })).toEqual([{ id: 3 }]);
    expect(extractList({ data: { shoot_codes: [{ id: 4 }] } })).toEqual([{ id: 4 }]);
  });

  it('trả mảng rỗng khi không tìm thấy', () => {
    expect(extractList({ foo: 'bar' })).toEqual([]);
    expect(extractList(null)).toEqual([]);
  });
});

describe('boothClient.normalizeCode', () => {
  it('chuẩn hoá mã Selfbooth', () => {
    const row = normalizeCode('selfbooth', {
      id: 12,
      code: 'SB-001',
      code_kind: 'PACKAGE',
      package: { id: 'p1', name: 'Gói 4 ảnh' },
      amount: '40000',
      note: 'Tiền mặt tại quầy',
      created_at: '2026-10-01T03:00:00Z',
    });
    expect(row).toMatchObject({
      system: 'selfbooth',
      external_id: '12',
      code: 'SB-001',
      code_kind: 'PACKAGE',
      package_id: 'p1',
      package_name: 'Gói 4 ảnh',
      value: 40000,
      note: 'Tiền mặt tại quầy',
    });
    expect(row.external_created_at).toBe('2026-10-01T03:00:00.000Z');
    expect(row.raw).toEqual(expect.objectContaining({ code: 'SB-001' }));
  });

  it('chuẩn hoá voucher Photobooth', () => {
    const row = normalizeCode('photobooth', {
      voucher_id: 99,
      voucher_code: 'PB-9',
      type: 'cash_code',
      value: 50000,
    });
    expect(row).toMatchObject({
      external_id: '99',
      code: 'PB-9',
      type: 'cash_code',
      value: 50000,
    });
  });

  it('xử lý field thiếu mà không lỗi', () => {
    const row = normalizeCode('selfbooth', {});
    expect(row.code).toBeNull();
    expect(row.external_id).toBeNull();
    expect(row.value).toBeNull();
    expect(row.external_created_at).toBeNull();
  });
});

describe('boothClient.normalizeSession', () => {
  it('đếm media từ mảng ảnh', () => {
    const row = normalizeSession('selfbooth', {
      session_id: 's1',
      code: 'SB-001',
      images: [{}, {}, {}, {}],
      captured_at: '2026-10-01T04:00:00Z',
    });
    expect(row).toMatchObject({
      external_id: 's1',
      code: 'SB-001',
      media_count: 4,
    });
    expect(row.captured_at).toBe('2026-10-01T04:00:00.000Z');
  });

  it('đọc media_count dạng số', () => {
    const row = normalizeSession('photobooth', {
      id: 7,
      code: 'PB-9',
      media_count: '3',
    });
    expect(row.media_count).toBe(3);
  });

  it('sinh external_id dự phòng khi thiếu id', () => {
    const row = normalizeSession('selfbooth', {
      code: 'SB-002',
      captured_at: '2026-10-01T04:00:00Z',
    });
    expect(row.external_id).toBe('SB-002:2026-10-01T04:00:00.000Z');
  });
});
