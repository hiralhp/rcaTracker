const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Incidents
  getIncidents:  ()         => request('/incidents'),
  getIncident:   (id)       => request(`/incidents/${id}`),
  createIncident:(body)     => request('/incidents', { method: 'POST', body }),

  // RCAs
  getRCAs:       (params={}) => request('/rcas?' + new URLSearchParams(params).toString()),
  getRCA:        (id)        => request(`/rcas/${id}`),
  advanceRCA:    (id, body)  => request(`/rcas/${id}/advance`, { method: 'PUT', body }),
  getCsms:       ()          => request('/rcas/meta/csms'),

  // Analytics
  stageAverages: (p={}) => request('/analytics/stage-averages?' + new URLSearchParams(p).toString()),
  cycleTime:     (p={}) => request('/analytics/cycle-time?' + new URLSearchParams(p).toString()),
  variance:      (p={}) => request('/analytics/variance?' + new URLSearchParams(p).toString()),
  slaSummary:    ()     => request('/analytics/sla-summary'),

  // Portal
  portal:        (id)   => request(`/portal/${id}`),
};
