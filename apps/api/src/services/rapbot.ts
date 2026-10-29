/**
 * Helper client to interact with RapBot Standalone Gateway
 */
export class RapBotClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor() {
    this.baseUrl = (process.env.RAPBOT_URL || 'http://localhost:3001').replace(/\/+$/, '');
    this.apiToken = process.env.RAPBOT_API_TOKEN || process.env.RAPBOT_PIN || '160509';
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiToken) {
      if (this.apiToken.startsWith('rap_live_')) {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      } else {
        // Fallback for PIN
        headers['x-admin-pin'] = this.apiToken;
      }
    }

    return headers;
  }

  /**
   * Register LinkVault to RapBot dynamic extension registry
   */
  async registerExtension(serviceEndpoint = 'http://localhost:4317') {
    try {
      const res = await fetch(`${this.baseUrl}/api/extensions/register`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          id: 'linkvault',
          name: 'LinkVault',
          version: '1.0.0',
          endpoint: serviceEndpoint,
          commands: [
            {
              name: 'lv',
              aliases: ['linkvault', 'vault'],
              description: 'Kelola dan cari bookmark tautan LinkVault (!lv help)',
              category: 'productivity'
            }
          ]
        })
      });

      if (!res.ok) {
        console.warn(`[RapBot] Registration returned ${res.status}: ${res.statusText}`);
        return false;
      }

      const json = await res.json();
      console.log(`[RapBot] ✅ Successfully registered to RapBot:`, json?.message || 'OK');
      return true;
    } catch (err: any) {
      console.warn(`[RapBot] ⚠️ Could not connect to RapBot Gateway (${err.message}). Will retry on next command or restart.`);
      return false;
    }
  }

  /**
   * Push a notification message to WhatsApp via RapBot
   */
  async sendNotification(target: { number?: string; groupId?: string }, message: string) {
    try {
      const res = await fetch(`${this.baseUrl}/api/bot/send`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          ...target,
          message
        })
      });
      return res.ok;
    } catch (err: any) {
      console.warn(`[RapBot] ⚠️ Failed sending notification to WhatsApp:`, err.message);
      return false;
    }
  }
}

export const rapbot = new RapBotClient();
