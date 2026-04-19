import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isMockMode } from '@/lib/auth';
import { configService } from '@/services/config.service';
import { MOCK_CONFIG } from '@/mock/data';

/** Get current config + client domains + VIP contacts + ignored domains. */
export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({
      config: MOCK_CONFIG,
      clientDomains: [
        { id: '1', domain: 'acmecorp.com', companyName: 'Acme Corporation', isActive: true },
        { id: '2', domain: 'globexinc.com', companyName: 'Globex Inc.', isActive: true },
        { id: '3', domain: 'initech.com', companyName: 'Initech', isActive: true },
        { id: '4', domain: 'umbrellacorp.net', companyName: 'Umbrella Corp', isActive: true },
        { id: '5', domain: 'wayneenterprises.com', companyName: 'Wayne Enterprises', isActive: true },
        { id: '6', domain: 'starkindustries.com', companyName: 'Stark Industries', isActive: true },
      ],
      vipContacts: [
        { id: '1', email: 'ceo@acmecorp.com', name: 'John Acme', companyName: 'Acme Corporation', priority: 3 },
        { id: '2', email: 'cfo@globexinc.com', name: 'Hank Scorpio', companyName: 'Globex Inc.', priority: 2 },
        { id: '3', email: 'bill@initech.com', name: 'Bill Lumbergh', companyName: 'Initech', priority: 2 },
      ],
      ignoredDomains: [
        { id: '1', domain: 'noreply.microsoft.com', reason: 'Microsoft system notifications' },
        { id: '2', domain: 'notifications.github.com', reason: 'GitHub notifications' },
        { id: '3', domain: 'linkedin.com', reason: 'LinkedIn notifications' },
      ],
      mock: true,
    });
  }

  try {
    await requireAuth();
    const [config, clientDomains, vipContacts, ignoredDomains] = await Promise.all([
      configService.getConfig(),
      configService.getClientDomains(),
      configService.getVipContacts(),
      configService.getIgnoredDomains(),
    ]);
    return NextResponse.json({ config, clientDomains, vipContacts, ignoredDomains });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}

/** Update config or manage lists. */
export async function POST(req: NextRequest) {
  if (isMockMode()) {
    return NextResponse.json({ ok: true, mock: true });
  }

  try {
    await requireAuth();
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'update_config':
        await configService.updateConfig(body.config);
        break;
      case 'add_client_domain':
        await configService.addClientDomain(body.domain, body.companyName);
        break;
      case 'remove_client_domain':
        await configService.removeClientDomain(body.id);
        break;
      case 'add_vip_contact':
        await configService.addVipContact(body.email, body.name, body.companyName, body.priority);
        break;
      case 'remove_vip_contact':
        await configService.removeVipContact(body.id);
        break;
      case 'add_ignored_domain':
        await configService.addIgnoredDomain(body.domain, body.reason);
        break;
      case 'remove_ignored_domain':
        await configService.removeIgnoredDomain(body.id);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
