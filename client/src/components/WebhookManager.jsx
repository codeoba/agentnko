import React, { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, TestTube, Copy, Check, AlertCircle, Globe } from 'lucide-react';

const EVENT_OPTIONS = [
  { value: 'new_message', label: '💬 Message Mpya' },
  { value: 'new_contact', label: '👤 Contact Mpya' },
  { value: 'new_order', label: '📦 Order Mpya' },
  { value: 'order_status_changed', label: '📦 Status ya Order Imebadilika' },
  { value: 'campaign_completed', label: '📢 Campaign Imekamilika' },
  { value: 'contact_opt_out', label: '🚫 Contact Ameomba Kuondolewa' },
  { value: 'payment_received', label: '💳 Malipo Yamepokelewa' },
];

export default function WebhookManager({ apiFetch, user }) {
  const [webhooks, setWebhooks] = useState([]);
  const [apiKey, setApiKey] = useState(user?.api_key || '');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [form, setForm] = useState({
    id: null, name: '', url: '', events: [], secret: '', active: 1
  });

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/webhooks');
      setWebhooks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateApiKey() {
    setGeneratingKey(true);
    try {
      const data = await apiFetch('/api/me/api-key', { method: 'POST' });
      setApiKey(data.api_key);
    } catch (err) {
      alert(err.message);
    } finally {
      setGeneratingKey(false);
    }
  }

  function copyApiKey() {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function toggleEvent(eventValue) {
    const events = form.events.includes(eventValue)
      ? form.events.filter(e => e !== eventValue)
      : [...form.events, eventValue];
    setForm({ ...form, events });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (form.events.length === 0) return alert('Chagua angalau event moja');
    setSaving(true);
    try {
      await apiFetch('/api/webhooks', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ id: null, name: '', url: '', events: [], secret: '', active: 1 });
      await loadWebhooks();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(id) {
    setTestingId(id);
    try {
      await apiFetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      alert('✅ Test payload imetumwa! Angalia URL yako.');
    } catch (err) {
      alert('❌ Test imeshindwa: ' + err.message);
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Futa webhook hii?')) return;
    try {
      await apiFetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      setWebhooks(webhooks.filter(w => w.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  function handleEdit(webhook) {
    setForm({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events?.split(',') || [],
      secret: '',
      active: webhook.active,
    });
    setShowForm(true);
  }

  return (
    <div className="webhook-manager">
      <div className="section-header">
        <div>
          <h2 className="section-title"><Globe size={22} /> Webhooks & REST API</h2>
          <p className="section-subtitle">Unganisha AgentNKO na mifumo mingine (Zapier, Make.com, n8n)</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setForm({ id: null, name: '', url: '', events: [], secret: '', active: 1 }); }}>
          <Plus size={16} /> Webhook Mpya
        </button>
      </div>

      {/* API Key Section */}
      <div className="api-key-card">
        <div className="api-key-header">
          <h3>🔑 REST API Key</h3>
          <p>Tumia API key hii kufikia AgentNKO kutoka mifumo ya nje</p>
        </div>
        <div className="api-key-display">
          <div className="api-key-value">
            {apiKey ? (
              <code>{apiKey}</code>
            ) : (
              <span className="api-key-empty">Bado haujatengeneza API key</span>
            )}
          </div>
          <div className="api-key-actions">
            {apiKey && (
              <button className="btn-icon" onClick={copyApiKey}>
                {copiedKey ? <Check size={16} /> : <Copy size={16} />}
              </button>
            )}
            <button className="btn-secondary" onClick={handleGenerateApiKey} disabled={generatingKey}>
              {generatingKey ? 'Inatengeneza...' : apiKey ? '🔄 Tengeneza Mpya' : '➕ Tengeneza API Key'}
            </button>
          </div>
        </div>
        {apiKey && (
          <div className="api-endpoints-preview">
            <h4>Endpoints zinazopatikana:</h4>
            <div className="endpoint-row"><span className="method get">GET</span><code>/api/v1/contacts</code><span>Pata contacts wote</span></div>
            <div className="endpoint-row"><span className="method post">POST</span><code>/api/v1/messages/send</code><span>Tuma message</span></div>
          </div>
        )}
      </div>

      {/* Webhook Form */}
      {showForm && (
        <div className="webhook-form-card">
          <h3>{form.id ? '✏️ Hariri Webhook' : '➕ Webhook Mpya'}</h3>
          <form onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Jina</label>
                <input type="text" className="form-input" placeholder="Mfano: Zapier Integration" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>URL ya Webhook</label>
                <input type="url" className="form-input" placeholder="https://hooks.zapier.com/..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>Secret (optional — kwa usalama wa signature)</label>
              <input type="text" className="form-input" placeholder="Secret key ya HMAC" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Events za kusikiliza ({form.events.length} zimechaguliwa)</label>
              <div className="events-checkbox-grid">
                {EVENT_OPTIONS.map(ev => (
                  <label key={ev.value} className={`event-checkbox ${form.events.includes(ev.value) ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.events.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Ghairi</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Inahifadhi...' : form.id ? 'Hifadhi' : 'Unda Webhook'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Webhooks List */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : webhooks.length === 0 ? (
        <div className="empty-state">
          <Webhook size={48} />
          <h3>Hakuna webhooks zilizoundwa</h3>
          <p>Unganisha na Zapier, Make.com, au n8n kwa kubonyeza "Webhook Mpya"</p>
        </div>
      ) : (
        <div className="webhooks-list">
          {webhooks.map(wh => (
            <div key={wh.id} className={`webhook-item ${!wh.active ? 'inactive' : ''}`}>
              <div className="webhook-item-icon">
                <Globe size={20} />
              </div>
              <div className="webhook-item-content">
                <div className="webhook-item-header">
                  <span className="webhook-name">{wh.name}</span>
                  <span className={`badge ${wh.active ? 'badge-green' : 'badge-gray'}`}>
                    {wh.active ? '✅ Hai' : '⏸️ Imesimamishwa'}
                  </span>
                </div>
                <div className="webhook-url">{wh.url}</div>
                <div className="webhook-events">
                  {wh.events?.split(',').map(ev => (
                    <span key={ev} className="event-badge">{EVENT_OPTIONS.find(e => e.value === ev)?.label || ev}</span>
                  ))}
                </div>
                <div className="webhook-stats">
                  <span className="stat-success">✅ {wh.success_count || 0} zilizofanikiwa</span>
                  <span className="stat-fail">❌ {wh.fail_count || 0} zilizoshindwa</span>
                  {wh.last_triggered && <span>📅 {new Date(wh.last_triggered).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="webhook-item-actions">
                <button className="btn-icon" onClick={() => handleTest(wh.id)} disabled={testingId === wh.id} title="Test">
                  <TestTube size={16} className={testingId === wh.id ? 'spin' : ''} />
                </button>
                <button className="btn-icon" onClick={() => handleEdit(wh)} title="Hariri">✏️</button>
                <button className="btn-icon danger" onClick={() => handleDelete(wh.id)} title="Futa">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
