import { defaultPaymentConfig } from './payment-config';

export interface ContractTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultTitle: string;
  body: string;
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'STANDARD_PHOTOGRAPHY',
    name: 'Photography Services Agreement',
    category: 'PORTRAIT',
    description: 'Standard terms for portrait, headshots, and event photography',
    defaultTitle: 'Photography Services & Licensing Agreement',
    body: `PHOTOGRAPHY SERVICES & CLIENT LICENSING AGREEMENT

This Agreement is entered into between {{studio_name}} (UEN: {{company_uen}}) and {{company_name}} (Attn: {{client_name}}).

1. PROJECT SCOPE & DELIVERABLES
Project: {{project_title}}
Shoot / Execution Date: {{shoot_date}}
Deliverables include high-resolution edited images delivered via private digital download within 14 business days following the shoot.

2. FEES & MILESTONE SETTLEMENT
Total Project Fee: SGD \${{total_amount}} (Inclusive of Singapore GST where applicable).
Booking Deposit (50%): SGD \${{deposit_amount}} payable upon execution of this Agreement to secure the booking date.
Balance Settlement: Due on or before delivery of the finalized deliverables.

3. COPYRIGHT & COMMERCIAL LICENSING
J Square Photography retains full moral and intellectual property ownership of all original photographs. The Client is granted a non-exclusive, perpetual, worldwide license to reproduce, publish, and utilize the delivered photographs for corporate, promotional, and marketing purposes across print and digital media.

4. CANCELLATION & POSTPONEMENT
Postponements made with more than 72 hours' advance notice will incur no penalty. Cancellations made within 48 hours of the scheduled shoot date forfeit the deposit.

5. GOVERNING LAW
This Agreement shall be governed and interpreted according to the laws of the Republic of Singapore.`,
  },
  {
    id: 'COMMERCIAL_VIDEOGRAPHY',
    name: 'Commercial Videography Production Contract',
    category: 'COMMERCIAL_VIDEO',
    description: 'Comprehensive agreement covering filming, audio, editing, and revision cycles',
    defaultTitle: 'Commercial Videography Production & License Agreement',
    body: `COMMERCIAL VIDEOGRAPHY PRODUCTION & LICENSE AGREEMENT

This Production Agreement is executed between {{studio_name}} (UEN: {{company_uen}}) and {{company_name}} (Attn: {{client_name}}).

1. PRODUCTION SPECIFICATIONS
Production Title: {{project_title}}
Principal Filming Date: {{shoot_date}}
Deliverables include:
- Final high-definition master video cuts as specified in the agreed project quotation
- Licensed background royalty-free audio tracks
- Standard color grading and audio mastering

2. REVISION ROUNDS
This agreement includes up to two (2) rounds of reasonable editorial revisions (pacing, cut adjustments, text overlays). Any substantial changes requiring re-filming or major script divergence after first cut approval shall be quoted separately.

3. FINANCIAL TERMS & MILESTONES
Total Consideration: SGD \${{total_amount}}
Deposit Required: SGD \${{deposit_amount}} to secure production crew and studio dates.
Final Balance Due: SGD \${{balance_due}} payable upon delivery of final master cut.

4. USAGE RIGHTS & RELEASE
Client receives commercial broadcast, digital web, and social media distribution rights. J Square Photography retains the right to display brief excerpts in its professional showreel.

5. SEVERABILITY & SINGAPORE JURISDICTION
This contract constitutes the entire understanding between the parties and is subject to the exclusive jurisdiction of the Courts of Singapore.`,
  },
  {
    id: 'WORKSHOP_TRAINING',
    name: 'Training Workshop Engagement Agreement',
    category: 'WORKSHOP',
    description: 'Terms for photography/videography training and educational workshops',
    defaultTitle: 'Corporate Photography Training Workshop Agreement',
    body: `CORPORATE TRAINING WORKSHOP ENGAGEMENT AGREEMENT

Between: {{studio_name}} (UEN: {{company_uen}})
And: {{company_name}} (Attn: {{client_name}})

1. WORKSHOP PROGRAM
Program: {{project_title}}
Scheduled Date: {{shoot_date}}
Location: Client Premises or Designated Studio Venue

2. PARTICIPATION & MATERIALS
J Square Photography shall provide instructor facilitation, workshop syllabus, and instructional materials for attendees. Attendees may bring their own equipment or utilize studio test cameras where arranged.

3. FEES & INVOICE
Total Training Fee: SGD \${{total_amount}}
Full settlement is due on or before {{due_date}}.

4. INTELLECTUAL PROPERTY OF TRAINING MATERIALS
All curriculum guides and instructional slides remain the exclusive property of J Square Photography.

5. GOVERNING JURISDICTION
Governed by the laws of the Republic of Singapore.`,
  },
];

export function renderContractTemplate(
  templateBody: string,
  variables: Record<string, string | number | undefined | null>
): string {
  let rendered = templateBody;

  const defaults: Record<string, string> = {
    company_uen: defaultPaymentConfig.uen,
    studio_name: defaultPaymentConfig.companyName.toUpperCase(),
    company_name: 'Client',
    client_name: 'Authorized Representative',
    project_title: 'Creative Services',
    shoot_date: 'To be determined',
    total_amount: '0.00',
    deposit_amount: '0.00',
    balance_due: '0.00',
    due_date: 'Upon Completion',
  };

  const merged = { ...defaults, ...variables };

  for (const [key, val] of Object.entries(merged)) {
    const stringVal = val !== undefined && val !== null ? String(val) : '';
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    // A function replacer, so $ characters in a name or title are never treated as replacement patterns
    rendered = rendered.replace(regex, () => stringVal);
  }

  return rendered;
}
