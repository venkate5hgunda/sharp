// No SDK, autocapture, cookies, session replay, or secret-bearing credentials.
export class MockTransport {
  constructor() { this.batches = []; }
  async send(batch, { signal } = {}) { if (signal?.aborted) throw new Error('cancelled'); this.batches.push(structuredClone(batch)); }
}
export class PostHogTransport {
  constructor({ publicProjectKey, host = 'https://us.i.posthog.com', fetcher = globalThis.fetch }) {
    const url = new URL(host);
    if (url.protocol !== 'https:' || !['us.i.posthog.com', 'eu.i.posthog.com'].includes(url.hostname) || url.username || url.password || !/^phc_[A-Za-z0-9]+$/.test(publicProjectKey)) throw new Error('Use a public PostHog project key and an approved ingestion host. Secret keys are never accepted.');
    this.host = url.origin; this.key = publicProjectKey; this.fetcher = fetcher;
  }
  async send(events, { signal } = {}) {
    // Per-batch identity avoids linking diagnostic activity to a player profile.
    const distinctId = crypto.randomUUID();
    const response = await this.fetcher(`${this.host}/batch/`, { method: 'POST', signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.key, batch: events.map((event) => ({ ...event, properties: { ...event.properties, distinct_id: distinctId } })) }) });
    if (!response.ok) throw new Error('Ingestion failed.');
  }
}
