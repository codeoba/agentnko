import React, { useState, useEffect } from 'react';
import { FlaskConical, Plus, Trash2, Trophy, BarChart2 } from 'lucide-react';

export default function ABTesting({ apiFetch }) {
  const [tests, setTests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', variant_a: '', variant_b: '',
    target_tags: '', split_ratio: 50, auto_select_after_hours: 24
  });

  useEffect(() => {
    loadTests();
  }, []);

  async function loadTests() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/ab-tests');
      setTests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.variant_a || !form.variant_b) return alert('Andika variants zote mbili');
    setSaving(true);
    try {
      const data = await apiFetch('/api/ab-tests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      alert(`✅ A/B Test imeanzishwa!\nGroup A: ${data.groups?.a || 0} contacts\nGroup B: ${data.groups?.b || 0} contacts`);
      setShowForm(false);
      setForm({ name: '', variant_a: '', variant_b: '', target_tags: '', split_ratio: 50, auto_select_after_hours: 24 });
      await loadTests();
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Futa test hii?')) return;
    try {
      await apiFetch(`/api/ab-tests/${id}`, { method: 'DELETE' });
      setTests(tests.filter(t => t.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  function getWinnerRate(test, variant) {
    const sent = variant === 'A' ? test.sent_a : test.sent_b;
    const replies = variant === 'A' ? test.reply_a : test.reply_b;
    return sent > 0 ? Math.round((replies / sent) * 100) : 0;
  }

  return (
    <div className="ab-testing">
      <div className="section-header">
        <div>
          <h2 className="section-title"><FlaskConical size={22} /> A/B Testing</h2>
          <p className="section-subtitle">Jaribu messages mbili tofauti kuona ipi inafanya vizuri zaidi</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Test Mpya
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="ab-form-card">
          <h3>🧪 A/B Test Mpya</h3>
          <form onSubmit={handleCreate}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Jina la Test</label>
                <input type="text" className="form-input" placeholder="Mfano: Promo Message Test" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Tag ya Lengo (optional)</label>
                <input type="text" className="form-input" placeholder="Mfano: vip" value={form.target_tags} onChange={e => setForm({ ...form, target_tags: e.target.value })} />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label>📝 Variant A (Ujumbe wa Kwanza)</label>
                <textarea className="form-input" rows={4} placeholder="Andika ujumbe wa variant A..." value={form.variant_a} onChange={e => setForm({ ...form, variant_a: e.target.value })} required />
                <div className="char-count">{form.variant_a.length} herufi</div>
              </div>
              <div className="form-group">
                <label>📝 Variant B (Ujumbe wa Pili)</label>
                <textarea className="form-input" rows={4} placeholder="Andika ujumbe wa variant B..." value={form.variant_b} onChange={e => setForm({ ...form, variant_b: e.target.value })} required />
                <div className="char-count">{form.variant_b.length} herufi</div>
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Mgawanyo (%A / %B)</label>
                <div className="split-slider-wrap">
                  <input type="range" min={10} max={90} step={5} value={form.split_ratio} onChange={e => setForm({ ...form, split_ratio: parseInt(e.target.value) })} />
                  <div className="split-labels">
                    <span className="split-a">A: {form.split_ratio}%</span>
                    <span className="split-b">B: {100 - form.split_ratio}%</span>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Chagua Winner Baada ya (masaa)</label>
                <input type="number" className="form-input" min={1} max={168} value={form.auto_select_after_hours} onChange={e => setForm({ ...form, auto_select_after_hours: parseInt(e.target.value) })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Ghairi</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Inatuma...' : '🚀 Anza Test'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tests List */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : tests.length === 0 ? (
        <div className="empty-state">
          <FlaskConical size={48} />
          <h3>Hakuna A/B tests</h3>
          <p>Unda test ya kwanza kujua ujumbe upi unafanya vizuri zaidi</p>
        </div>
      ) : (
        <div className="ab-tests-list">
          {tests.map(test => {
            const rateA = getWinnerRate(test, 'A');
            const rateB = getWinnerRate(test, 'B');
            const isCompleted = test.status === 'completed';
            return (
              <div key={test.id} className={`ab-test-card ${isCompleted ? 'completed' : ''}`}>
                <div className="ab-test-header">
                  <h3>{test.name}</h3>
                  <div className="ab-test-status">
                    <span className={`badge ${isCompleted ? 'badge-green' : 'badge-blue'}`}>
                      {isCompleted ? '✅ Imekamilika' : '🔄 Inaendelea'}
                    </span>
                    {test.winner && (
                      <span className="winner-badge">
                        <Trophy size={14} /> Winner: Variant {test.winner}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ab-variants-grid">
                  <div className={`variant-card ${test.winner === 'A' ? 'winner' : ''}`}>
                    <div className="variant-label">Variant A</div>
                    <div className="variant-message">{test.variant_a?.slice(0, 100)}...</div>
                    <div className="variant-stats">
                      <span>📤 {test.sent_a || 0} walipokelewa</span>
                      <span>💬 {test.reply_a || 0} walijibu</span>
                      <span className="rate-badge">Rate: {rateA}%</span>
                    </div>
                    <div className="variant-progress">
                      <div className="variant-bar" style={{ width: `${rateA}%` }} />
                    </div>
                    {test.winner === 'A' && <div className="winner-tag"><Trophy size={12} /> Winner!</div>}
                  </div>
                  <div className={`variant-card ${test.winner === 'B' ? 'winner' : ''}`}>
                    <div className="variant-label">Variant B</div>
                    <div className="variant-message">{test.variant_b?.slice(0, 100)}...</div>
                    <div className="variant-stats">
                      <span>📤 {test.sent_b || 0} walipokelewa</span>
                      <span>💬 {test.reply_b || 0} walijibu</span>
                      <span className="rate-badge">Rate: {rateB}%</span>
                    </div>
                    <div className="variant-progress">
                      <div className="variant-bar" style={{ width: `${rateB}%` }} />
                    </div>
                    {test.winner === 'B' && <div className="winner-tag"><Trophy size={12} /> Winner!</div>}
                  </div>
                </div>
                <div className="ab-test-footer">
                  <span>📅 {new Date(test.created_at).toLocaleDateString('sw-TZ')}</span>
                  {test.target_tags && <span>🏷️ Tag: {test.target_tags}</span>}
                  <span>⏱️ Winner baada ya saa {test.auto_select_after_hours || 24}</span>
                  <button className="btn-icon danger" onClick={() => handleDelete(test.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
