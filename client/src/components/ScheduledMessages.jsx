import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Calendar, Send, ToggleLeft, ToggleRight } from 'lucide-react';

const CRON_OPTIONS = [
  { value: 'once', label: 'Mara moja tu' },
  { value: 'daily', label: 'Kila siku (08:00 EAT)' },
  { value: 'weekly_monday', label: 'Kila Jumatatu asubuhi' },
  { value: 'weekly_friday', label: 'Kila Ijumaa asubuhi' },
  { value: 'monthly', label: 'Mara moja kwa mwezi' },
];

const TARGET_OPTIONS = [
  { value: 'all', label: 'Contacts Wote' },
  { value: 'tag', label: 'Kwa Tag' },
  { value: 'segment', label: 'Kwa Segment' },
  { value: 'phone', label: 'Namba Moja tu' },
];

const STATUS_BADGES = {
  pending: { label: '⏳ Inasubiri', cls: 'badge-pending' },
  sending: { label: '🚀 Inatuma', cls: 'badge-sending' },
  sent: { label: '✅ Imetumwa', cls: 'badge-sent' },
  failed: { label: '❌ Imeshindwa', cls: 'badge-failed' },
};

export default function ScheduledMessages({ apiFetch }) {
  const [messages, setMessages] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    message: '',
    target_type: 'all',
    target_value: '',
    schedule_type: 'once',
    scheduled_at: '',
    cron_expression: 'daily',
    timezone: 'Africa/Dar_es_Salaam',
  });

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/scheduled-messages');
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getDefaultDateTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    return now.toISOString().slice(0, 16);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.schedule_type === 'once') {
        payload.cron_expression = null;
      }
      await apiFetch('/api/scheduled-messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setForm({
        name: '', message: '', target_type: 'all', target_value: '',
        schedule_type: 'once', scheduled_at: '', cron_expression: 'daily',
        timezone: 'Africa/Dar_es_Salaam'
      });
      await loadMessages();
    } catch (err) {
      alert('Kosa: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Una uhakika unataka kufuta?')) return;
    try {
      await apiFetch(`/api/scheduled-messages/${id}`, { method: 'DELETE' });
      setMessages(messages.filter(m => m.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleTogglePause(msg) {
    const newStatus = msg.status === 'pending' ? 'paused' : 'pending';
    try {
      await apiFetch(`/api/scheduled-messages/${msg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await loadMessages();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="scheduled-messages">
      <div className="section-header">
        <div>
          <h2 className="section-title"><Clock size={22} /> Scheduled Messages</h2>
          <p className="section-subtitle">Panga messages zitumwe wakati maalum (EAT +3)</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); if (!showForm) setForm(f => ({ ...f, scheduled_at: getDefaultDateTime() })); }}>
          <Plus size={16} /> Panga Message Mpya
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="sched-form-card">
          <h3>📅 Message Mpya ya Scheduled</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Jina la Message</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Mfano: Promo ya Jumatatu"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Aina ya Lengo</label>
                <select
                  className="form-input"
                  value={form.target_type}
                  onChange={e => setForm({ ...form, target_type: e.target.value })}
                >
                  {TARGET_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {(form.target_type === 'tag' || form.target_type === 'phone') && (
              <div className="form-group">
                <label>{form.target_type === 'tag' ? 'Tag' : 'Namba ya Simu'}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={form.target_type === 'tag' ? 'Mfano: vip' : '255712345678'}
                  value={form.target_value}
                  onChange={e => setForm({ ...form, target_value: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <label>Ujumbe</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Andika ujumbe hapa..."
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                required
              />
              <div className="char-count">{form.message.length} herufi</div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Aina ya Ratiba</label>
                <select
                  className="form-input"
                  value={form.schedule_type}
                  onChange={e => setForm({ ...form, schedule_type: e.target.value })}
                >
                  <option value="once">Mara Moja</option>
                  <option value="recurring">Inayorudiwa</option>
                </select>
              </div>

              {form.schedule_type === 'once' ? (
                <div className="form-group">
                  <label>Wakati wa Kutuma (EAT)</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={form.scheduled_at}
                    onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Muda wa Kurudia</label>
                  <select
                    className="form-input"
                    value={form.cron_expression}
                    onChange={e => setForm({ ...form, cron_expression: e.target.value })}
                  >
                    {CRON_OPTIONS.filter(o => o.value !== 'once').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Ghairi</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Send size={16} />
                {saving ? 'Inahifadhi...' : 'Panga Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Messages List */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>Hakuna messages zilizopangwa</h3>
          <p>Bonyeza "Panga Message Mpya" kuanza</p>
        </div>
      ) : (
        <div className="sched-list">
          {messages.map(msg => {
            const badge = STATUS_BADGES[msg.status] || STATUS_BADGES.pending;
            return (
              <div key={msg.id} className="sched-item">
                <div className="sched-item-icon">
                  <Clock size={20} />
                </div>
                <div className="sched-item-content">
                  <div className="sched-item-header">
                    <span className="sched-item-name">{msg.name}</span>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="sched-item-msg">{msg.message.slice(0, 80)}{msg.message.length > 80 ? '...' : ''}</div>
                  <div className="sched-item-meta">
                    <span>📅 {new Date(msg.scheduled_at).toLocaleString('sw-TZ')}</span>
                    <span>👥 {msg.target_type === 'all' ? 'Contacts Wote' : msg.target_type + ': ' + msg.target_value}</span>
                    {msg.schedule_type === 'recurring' && <span>🔄 Inayorudiwa ({msg.cron_expression})</span>}
                    {msg.sent_count > 0 && <span>✅ Imetumwa kwa {msg.sent_count}</span>}
                  </div>
                </div>
                <div className="sched-item-actions">
                  {msg.status === 'pending' && (
                    <button className="btn-icon" onClick={() => handleTogglePause(msg)} title="Simamisha">
                      <ToggleRight size={16} />
                    </button>
                  )}
                  <button className="btn-icon danger" onClick={() => handleDelete(msg.id)} title="Futa">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
