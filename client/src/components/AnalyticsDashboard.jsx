import React, { useState, useEffect } from 'react';
import {
  TrendingUp, MessageSquare, Users, Send, Clock, Zap, Eye,
  ArrowUp, ArrowDown, BarChart3, RefreshCw, Hash
} from 'lucide-react';

export default function AnalyticsDashboard({ apiFetch, t }) {
  const [overview, setOverview] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [responseTimes, setResponseTimes] = useState(null);
  const [contactGrowth, setContactGrowth] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [days]);

  async function loadAll() {
    setLoading(true);
    try {
      const [ov, kw, rt, cg] = await Promise.all([
        apiFetch(`/api/analytics/overview?days=${days}`),
        apiFetch(`/api/analytics/keywords?days=${days}&limit=15`),
        apiFetch(`/api/analytics/response-times?days=${days}`),
        apiFetch('/api/analytics/contact-growth'),
      ]);
      setOverview(ov);
      setKeywords(kw);
      setResponseTimes(rt);
      setContactGrowth(cg);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function getBarWidth(count, max) {
    return max > 0 ? Math.round((count / max) * 100) : 0;
  }

  const maxKeyword = keywords.length > 0 ? keywords[0].count : 1;

  // Build daily chart data
  const dailyLabels = overview?.daily_data?.map(d => d.date?.slice(5)) || [];
  const dailyIncoming = overview?.daily_data?.map(d => d.incoming_count) || [];
  const dailyOutgoing = overview?.daily_data?.map(d => d.outgoing_count) || [];
  const maxDaily = Math.max(...dailyIncoming, ...dailyOutgoing, 1);

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">
            <BarChart3 size={22} />
            Analytics Dashboard
          </h2>
          <p className="analytics-subtitle">Takwimu za matumizi ya AgentNKO yako</p>
        </div>
        <div className="analytics-controls">
          <select
            className="analytics-period-select"
            value={days}
            onChange={e => setDays(parseInt(e.target.value))}
          >
            <option value={7}>Wiki 1</option>
            <option value={30}>Mwezi 1</option>
            <option value={90}>Miezi 3</option>
          </select>
          <button className="btn-refresh" onClick={loadAll} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading && <div className="analytics-loading"><div className="spinner" /><span>Inapakia takwimu...</span></div>}

      {!loading && overview && (
        <>
          {/* Stats Cards */}
          <div className="analytics-stats-grid">
            <StatCard
              icon={<MessageSquare size={20} />}
              label="Messages Zilizoingia"
              value={overview.totals.incoming.toLocaleString()}
              color="blue"
              sub={`Kutoka siku ${days} zilizopita`}
            />
            <StatCard
              icon={<Send size={20} />}
              label="Messages Zilizotumwa"
              value={overview.totals.outgoing.toLocaleString()}
              color="green"
              sub={`AI: ${overview.totals.ai_responses} | Manual: ${overview.totals.manual_responses}`}
            />
            <StatCard
              icon={<Zap size={20} />}
              label="AI Automation Rate"
              value={`${overview.ai_automation_rate}%`}
              color="purple"
              sub="Messages zilizojibiwa na AI"
            />
            <StatCard
              icon={<TrendingUp size={20} />}
              label="Conversion Rate"
              value={`${overview.conversion_rate}%`}
              color="orange"
              sub="Wateja walioshughulikiwa"
            />
            <StatCard
              icon={<Users size={20} />}
              label="Contacts Wapya"
              value={contactGrowth?.this_week || 0}
              color="teal"
              growth={contactGrowth?.growth_percent}
              sub="Wiki hii"
            />
            <StatCard
              icon={<Clock size={20} />}
              label="Wakati wa Kujibu"
              value={`${responseTimes?.avg_seconds || 0}s`}
              color="pink"
              sub={`Max: ${responseTimes?.max_seconds || 0}s | Min: ${responseTimes?.min_seconds || 0}s`}
            />
          </div>

          {/* Daily Messages Chart */}
          <div className="analytics-section">
            <h3 className="analytics-section-title">📈 Messages kwa Siku ({days} siku)</h3>
            <div className="chart-container">
              {dailyLabels.length === 0 ? (
                <div className="chart-empty">Hakuna data ya kutosha. Anza kuwasiliana na wateja.</div>
              ) : (
                <div className="bar-chart">
                  {dailyLabels.map((label, i) => (
                    <div key={i} className="bar-group">
                      <div className="bar-pair">
                        <div
                          className="bar bar-incoming"
                          style={{ height: `${getBarWidth(dailyIncoming[i], maxDaily)}%` }}
                          title={`Incoming: ${dailyIncoming[i]}`}
                        />
                        <div
                          className="bar bar-outgoing"
                          style={{ height: `${getBarWidth(dailyOutgoing[i], maxDaily)}%` }}
                          title={`Outgoing: ${dailyOutgoing[i]}`}
                        />
                      </div>
                      <div className="bar-label">{label}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-dot blue" /> Incoming</span>
                <span className="legend-item"><span className="legend-dot green" /> Outgoing</span>
              </div>
            </div>
          </div>

          {/* Top Keywords */}
          <div className="analytics-section">
            <h3 className="analytics-section-title"><Hash size={16} /> Maneno Yanayotumiwa Zaidi na Wateja</h3>
            {keywords.length === 0 ? (
              <div className="chart-empty">Hakuna maneno ya kutosha bado.</div>
            ) : (
              <div className="keywords-list">
                {keywords.map((kw, i) => (
                  <div key={i} className="keyword-row">
                    <span className="keyword-rank">#{i + 1}</span>
                    <span className="keyword-word">{kw.word}</span>
                    <div className="keyword-bar-wrap">
                      <div
                        className="keyword-bar"
                        style={{ width: `${getBarWidth(kw.count, maxKeyword)}%` }}
                      />
                    </div>
                    <span className="keyword-count">{kw.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Performance */}
          <div className="analytics-section">
            <h3 className="analytics-section-title">🤖 Utendaji wa AI</h3>
            <div className="ai-performance-grid">
              <div className="ai-perf-card">
                <div className="ai-perf-value">{overview.totals.ai_responses.toLocaleString()}</div>
                <div className="ai-perf-label">Majibu ya AI</div>
              </div>
              <div className="ai-perf-card">
                <div className="ai-perf-value">{overview.totals.manual_responses.toLocaleString()}</div>
                <div className="ai-perf-label">Majibu ya Binadamu</div>
              </div>
              <div className="ai-perf-card">
                <div className="ai-perf-value ai-perf-big">{overview.ai_automation_rate}%</div>
                <div className="ai-perf-label">Automation Rate</div>
                <div className="ai-perf-bar-wrap">
                  <div className="ai-perf-bar" style={{ width: `${overview.ai_automation_rate}%` }} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, sub, growth }) {
  return (
    <div className={`analytics-stat-card stat-card-${color}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-content">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
        {growth !== undefined && (
          <div className={`stat-card-growth ${growth >= 0 ? 'positive' : 'negative'}`}>
            {growth >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {Math.abs(growth)}% vs wiki iliyopita
          </div>
        )}
      </div>
    </div>
  );
}
