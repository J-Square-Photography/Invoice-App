/** Common banks across Asia for the Settings bank-name dropdown, Singapore first. */
export const BANK_GROUPS: Array<{ group: string; banks: string[] }> = [
  {
    group: 'Singapore',
    banks: [
      'DBS Bank Ltd',
      'POSB Bank',
      'OCBC Bank',
      'United Overseas Bank (UOB)',
      'Standard Chartered Bank (Singapore)',
      'HSBC Singapore',
      'Citibank Singapore',
      'Maybank Singapore',
      'CIMB Bank Singapore',
      'Bank of China (Singapore)',
      'ICBC Singapore',
      'Trust Bank',
      'GXS Bank',
      'MariBank',
    ],
  },
  {
    group: 'Malaysia',
    banks: ['Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank', 'AmBank'],
  },
  {
    group: 'Hong Kong',
    banks: ['HSBC Hong Kong', 'Hang Seng Bank', 'Bank of China (Hong Kong)', 'Standard Chartered Hong Kong'],
  },
  {
    group: 'China & Taiwan',
    banks: [
      'Industrial and Commercial Bank of China (ICBC)',
      'Bank of China',
      'China Construction Bank',
      'Agricultural Bank of China',
      'CTBC Bank',
    ],
  },
  {
    group: 'Japan & South Korea',
    banks: [
      'MUFG Bank',
      'Sumitomo Mitsui Banking Corporation (SMBC)',
      'Mizuho Bank',
      'KB Kookmin Bank',
      'Shinhan Bank',
    ],
  },
  {
    group: 'Indonesia',
    banks: ['Bank Central Asia (BCA)', 'Bank Mandiri', 'Bank Negara Indonesia (BNI)', 'Bank Rakyat Indonesia (BRI)'],
  },
  {
    group: 'Thailand, Philippines & Vietnam',
    banks: [
      'Bangkok Bank',
      'Kasikornbank',
      'Siam Commercial Bank',
      'BDO Unibank',
      'Bank of the Philippine Islands (BPI)',
      'Vietcombank',
    ],
  },
  {
    group: 'India',
    banks: ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank'],
  },
];

export const ALL_BANKS: string[] = BANK_GROUPS.flatMap((g) => g.banks);
