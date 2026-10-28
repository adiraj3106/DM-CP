// ═══════════════════════════════════════════════════════════════════════════════
// AgriGuard — Dashboard Layout Component
// Modular analytics workspace with neutral surfaces and green navigation accents
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useClaims } from '../context/ClaimsContext';
import {
  formatInr,
  formatRiskPercent,
} from '../utils/formatters';
import {
  ShieldAlert,
  Search,
  Filter,
  RotateCcw,
  Pin,
  ChevronRight,
  X,
  FileText,
  Network,
  Eye,
  Activity,
  Layers,
  Minimize2,
  Download,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';
import { NetworkGraphPanel } from './NetworkGraphPanel';
import { AnalyticsPanel } from './AnalyticsPanel';



export function DashboardLayout() {
  const {
    state,
    filteredClaims,
    selectedClaim,
    stats,
    selectClaim,
    updateFilters,
    resetFilters,
    setSort,
    toggleSortDirection,
    toggleDetailPanel,
    toggleNetworkPanel,
    togglePinClaim,
    setInvestigatorNotes,
    refetchClaims,
  } = useClaims();

  const [activeTab, setActiveTab] = useState<'claims' | 'analytics' | 'network'>('claims');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('agriguard-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [tablePage, setTablePage] = useState(0);
  const pageSize = 50;
  const visibleClaims = filteredClaims.slice(tablePage * pageSize, (tablePage + 1) * pageSize);
  useEffect(() => setTablePage(0), [state.filters]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('agriguard-theme', theme);
  }, [theme]);

  // Active filter state variables
  const currentSearch = state.filters.searchQuery;
  const activeTiers = state.filters.tiers;
  const isAllTiersActive = activeTiers.length === 0;
  const exportClaims = () => {
    const columns = ['Claim ID','Policy','Producer','Assessor','District','Taluka','Crop','Peril','Claim amount INR','Risk score','Triage','Rule flag'];
    const rows = filteredClaims.map((c) => [c.metadata.claimId,c.metadata.policyNumber,c.metadata.farmerName,c.metadata.assessorName,c.metadata.parcel.district,c.metadata.parcel.taluka,c.metadata.cropType,c.metadata.perilType,c.metadata.claimAmountInr,c.riskScore.composite * 100,c.riskScore.tier,c.riskFlag ?? 0]);
    const csv = [columns, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'agriguard-claims.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-shell relative flex h-screen w-screen overflow-hidden bg-app-canvas text-app-ink font-sans antialiased select-none">
      {/* ── 1. SIDEBAR — Warm cream navigation shelf ────────────────────────── */}
      <aside
        className={`dashboard-sidebar flex flex-col justify-between border-r border-white/10 bg-app-sidebar text-white transition-all duration-300 z-30 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Top Header / Branding */}
        <div>
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ABD9BD] text-[#173A27] text-xs font-bold tracking-wider">
                  AG
                </div>
                <div className="dashboard-brand-copy">
                  <h1 className="font-heading text-[15px] font-semibold tracking-tight text-white">
                    AgriGuard
                  </h1>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                    Risk Analytics v2.4
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#ABD9BD] text-[#173A27] text-xs font-bold">
                AG
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-white/55 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              title={sidebarCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <Minimize2 size={14} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-5 px-3 space-y-1">
            <button
              onClick={() => setActiveTab('claims')}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-colors ${
                activeTab === 'claims'
                  ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                  : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ShieldAlert size={16} className={activeTab === 'claims' ? 'text-[#B8E3C2]' : 'text-[#ABD9BD]'} />
              {!sidebarCollapsed && <span className="dashboard-sidebar-label">Claims Triage</span>}
            </button>

            <button
              onClick={() => {
                setActiveTab('network');
                toggleNetworkPanel(true);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-colors ${
                activeTab === 'network'
                  ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                  : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Network size={16} className={activeTab === 'network' ? 'text-[#B8E3C2]' : 'text-[#9F7F50]'} />
              {!sidebarCollapsed && <span className="dashboard-sidebar-label">Claim Network</span>}
            </button>

            <button
              onClick={() => { setActiveTab('analytics'); toggleDetailPanel(false); toggleNetworkPanel(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                  : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Layers size={16} className={activeTab === 'analytics' ? 'text-[#B8E3C2]' : 'text-[#ABD9BD]'} />
              {!sidebarCollapsed && <span className="dashboard-sidebar-label">Portfolio Analytics</span>}
            </button>
          </nav>

          {/* Quick Metrics Summary Sidebar Widget */}
          {!sidebarCollapsed && (
            <div className="dashboard-quick-metrics mx-3 mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/50 mb-3">
                <span className="font-semibold">Risk Distribution</span>
                <Activity size={12} className="text-[#ABD9BD]" />
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-[#EF9A8B] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-app-investigate"></span>
                    Investigate
                  </span>
                  <span className="font-mono font-bold text-white">{stats.tierCounts.investigate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-[#C6A77B] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-app-review"></span>
                    Review
                  </span>
                  <span className="font-mono font-bold text-white">{stats.tierCounts.review}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-[#ABD9BD] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ABD9BD]"></span>
                    Safe
                  </span>
                  <span className="font-mono font-bold text-white">{stats.tierCounts.safe}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sidebar Status Footer */}
        <div className="dashboard-sidebar-footer border-t border-white/10 p-3 text-[11px] text-white/55">
          {!sidebarCollapsed ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span>Portfolio:</span>
                <span className="text-[#C6A77B] font-semibold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-app-review"></span>
                  {stats.totalClaims.toLocaleString('en-IN')} CLAIMS
                </span>
              </div>
              <div className="text-[10px] text-white/40">
                Illustrative dataset · precomputed scores
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="h-2 w-2 rounded-full bg-[#ABD9BD]" title="Illustrative portfolio data"></span>
            </div>
          )}
        </div>
      </aside>

      {/* ── 2. MAIN CONTENT AREA ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Control Bar */}
        <header className="dashboard-topbar flex h-16 items-center justify-between border-b border-app-line bg-app-panel px-6 shadow-[0_1px_2px_rgba(20,35,24,0.03)]">
          {/* Breadcrumb & Title */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase text-app-muted tracking-wider">
              AGRICULTURAL RISK /
            </span>
            <h2 className="dashboard-top-title font-heading text-[15px] font-semibold tracking-tight text-app-ink">
              Claims Risk Workspace
            </h2>
          </div>

          {/* Metrics & Actions */}
          <div className="dashboard-top-actions flex items-center gap-5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-app-muted">Total Exposure:</span>
              <span className="font-mono font-bold text-app-ink">{formatInr(stats.totalExposureUsd)}</span>
            </div>
            <div className="h-4 w-px bg-app-panel-soft"></div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-app-muted">Avg Risk:</span>
              <span className="font-mono font-bold text-app-investigate">{formatRiskPercent(stats.avgCompositeScore)}</span>
            </div>
            <div className="h-4 w-px bg-app-panel-soft"></div>

            {/* Theme and Workspace Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-2 rounded-xl border border-app-line bg-app-panel px-2.5 py-1.5 text-[10px] font-medium text-app-muted transition-colors hover:border-app-primary hover:text-app-primary"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-pressed={theme === 'dark'}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
              <button onClick={exportClaims} className="rounded-xl border border-app-line bg-app-panel p-2.5 text-app-muted hover:border-app-primary hover:text-app-primary transition-colors" title="Export filtered claims as CSV"><Download size={14} /></button>
              <button onClick={refetchClaims} className="rounded-xl border border-app-line bg-app-panel p-2.5 text-app-muted hover:border-app-primary hover:text-app-primary transition-colors" title="Reload portfolio claims"><RefreshCw size={14} /></button>
              <button
                onClick={() => toggleDetailPanel()}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                  state.isDetailPanelOpen
                    ? 'border-app-primary bg-app-primary-soft text-app-primary'
                    : 'border-app-line bg-app-panel text-app-muted hover:bg-app-canvas hover:text-app-ink'
                }`}
              >
                <FileText size={14} />
                <span>Inspector</span>
              </button>

              <button
                onClick={() => toggleNetworkPanel()}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                  state.isNetworkPanelOpen
                    ? 'border-app-review bg-app-review-soft text-app-review'
                    : 'border-app-line bg-app-panel text-app-muted hover:bg-app-canvas hover:text-app-ink'
                }`}
              >
                <Network size={14} />
                <span>Claim Network</span>
              </button>
            </div>
          </div>
        </header>

        {activeTab === 'analytics' ? <AnalyticsPanel claims={filteredClaims} /> : <>
        {/* Filter & Toolbar Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-line bg-app-panel px-6 py-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" size={14} />
            <input
              type="text"
              value={currentSearch}
              onChange={(e) => { setTablePage(0); updateFilters({ searchQuery: e.target.value }); }}
              placeholder="Search claim, producer, assessor, district, taluka, crop, peril..."
              className="w-full rounded-xl border border-app-line bg-app-panel-soft pl-9 pr-3 py-2.5 text-xs text-app-ink placeholder-app-muted focus:border-app-primary focus:outline-none focus:ring-1 focus:ring-app-primary"
            />
            {currentSearch && (
              <button
                onClick={() => { setTablePage(0); updateFilters({ searchQuery: '' }); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-ink"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 rounded-xl border border-app-line bg-app-canvas p-1">
              <button
                onClick={() => updateFilters({ tiers: [] })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isAllTiersActive
                    ? 'bg-app-primary-fill text-white font-semibold shadow-sm'
                    : 'text-app-muted hover:bg-app-panel-soft'
                }`}
              >
                All ({stats.totalClaims})
              </button>
              <button
                onClick={() => updateFilters({ tiers: ['investigate'] })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTiers.includes('investigate')
                    ? 'bg-app-investigate text-white font-semibold shadow-sm'
                    : 'text-app-investigate hover:bg-app-investigate-soft'
                }`}
              >
                Investigate ({stats.tierCounts.investigate})
              </button>
              <button
                onClick={() => updateFilters({ tiers: ['review'] })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTiers.includes('review')
                    ? 'bg-app-review text-white font-semibold shadow-sm'
                    : 'text-app-review hover:bg-app-review-soft'
                }`}
              >
                Review ({stats.tierCounts.review})
              </button>
              <button
                onClick={() => updateFilters({ tiers: ['safe'] })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTiers.includes('safe')
                    ? 'bg-app-safe text-white font-semibold shadow-sm'
                    : 'text-app-safe hover:bg-app-safe-soft'
                }`}
              >
                Safe ({stats.tierCounts.safe})
              </button>
            </div>

            {/* Pinned Filter Toggle */}
            <button
              onClick={() => updateFilters({ pinnedOnly: !state.filters.pinnedOnly })}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors ${
                state.filters.pinnedOnly
                  ? 'border-app-review bg-app-review-soft text-app-review'
                  : 'border-app-line bg-app-panel text-app-muted hover:bg-app-canvas'
              }`}
            >
              <Pin size={12} className={state.filters.pinnedOnly ? 'fill-app-review' : ''} />
              <span>Pinned Only</span>
            </button>

            {/* Reset Filters */}
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-app-muted hover:text-app-ink px-2 py-1 rounded-full hover:bg-app-panel-soft"
              title="Reset Filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* ── 3. CLAIMS TABLE & INSPECTOR SPLIT ────────────────────────────────── */}
        <div className="claims-workspace relative flex flex-1 overflow-hidden">
          {/* Main Left Pane: Claims Table */}
          <main
            className={`claims-main flex-1 flex flex-col overflow-y-auto bg-app-canvas transition-all ${
              state.isDetailPanelOpen || state.isNetworkPanelOpen ? 'w-1/2 min-w-[520px]' : 'w-full'
            }`}
          >
            {filteredClaims.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 p-12 text-center text-app-muted">
                <Filter size={32} className="mb-3 text-app-subtle" />
                <p className="font-heading text-base font-semibold text-app-ink">No claims match the active filter criteria.</p>
                <p className="text-xs mt-1 text-app-muted">
                  Try adjusting your search query or clearing risk tier filters.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-4 rounded-full bg-app-primary-fill px-4 py-2 text-xs font-semibold text-white hover:bg-app-primary-hover transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="claims-table-scroll w-full overflow-x-auto">
                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-app-line bg-app-panel-soft text-[11px] uppercase tracking-[0.12em] text-app-muted sticky top-0 z-10">
                      <th className="py-3 px-4 w-10 text-center font-medium">Pin</th>
                      <th
                        className="py-3 px-4 font-semibold cursor-pointer hover:text-app-ink tracking-wider"
                        onClick={() => {
                          setSort('claimId');
                          toggleSortDirection();
                        }}
                      >
                        Claim ID / Policy
                      </th>
                      <th className="py-3 px-4 font-semibold tracking-wider">Producer & Assessor</th>
                      <th className="py-3 px-4 font-semibold tracking-wider">Crop / Cause</th>
                      <th
                        className="py-3 px-4 font-semibold text-right cursor-pointer hover:text-app-ink tracking-wider"
                        onClick={() => {
                          setSort('claimAmountInr');
                          toggleSortDirection();
                        }}
                      >
                        Claim Indemnity
                      </th>
                      <th
                        className="py-3 px-4 font-semibold text-center cursor-pointer hover:text-app-ink tracking-wider"
                        onClick={() => {
                          setSort('composite');
                          toggleSortDirection();
                        }}
                      >
                        Risk Index & Tier
                      </th>
                      <th className="py-3 px-4 font-semibold text-center tracking-wider">Pillar Anomalies</th>
                      <th className="py-3 px-4 font-semibold text-right pr-5 tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleClaims.map((claim, rowIdx) => {
                      const isSelected = selectedClaim?.metadata.claimId === claim.metadata.claimId;
                      const gnnCount = claim.anomalies.filter((a) => a.pillar === 'gnn').length;

                      return (
                        <tr
                          key={claim.metadata.claimId}
                          onClick={() => { setActiveTab('claims'); selectClaim(claim.metadata.claimId); }}
                          className={`cursor-pointer transition-colors border-b border-app-line ${
                            isSelected
                              ? 'bg-app-primary-soft hover:bg-app-primary-soft'
                              : rowIdx % 2 === 0
                              ? 'bg-app-panel hover:bg-app-canvas'
                              : 'bg-app-canvas hover:bg-app-panel-soft'
                          }`}
                        >
                          {/* Pin Toggle */}
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => togglePinClaim(claim.metadata.claimId)}
                              className="text-app-muted hover:text-app-review transition-colors"
                            >
                              <Pin
                                size={13}
                                className={claim.isPinned ? 'fill-app-review text-app-review' : ''}
                              />
                            </button>
                          </td>

                          {/* Claim ID & Policy */}
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-app-ink text-sm">
                              {claim.metadata.claimId}
                            </div>
                            <div className="text-[11px] font-mono text-app-muted">
                              {claim.metadata.policyNumber}
                            </div>
                          </td>

                          {/* Producer & Assessor */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-sm text-app-ink">{claim.metadata.farmerName}</div>
                            <div className="mt-0.5 text-xs text-app-muted">{claim.metadata.parcel.taluka}, {claim.metadata.parcel.district}</div>
                            <div className="mt-0.5 text-[11px] text-app-muted">Assessor: {claim.metadata.assessorName}</div>
                          </td>

                          {/* Crop & Peril */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-sm text-app-ink">{claim.metadata.cropType}</div>
                            <div className="mt-0.5 text-xs text-app-muted">{claim.metadata.perilType} · {claim.metadata.claimedDamagePct}% reported loss</div>
                          </td>

                          {/* Indemnity Amount */}
                          <td className="py-3 px-4 text-right">
                            <div className="font-mono text-sm font-bold text-app-ink">
                              {formatInr(claim.metadata.claimAmountInr)}
                            </div>
                            <div className="text-[11px] font-mono text-app-muted">
                              Est. coverage: {formatInr(claim.metadata.policyValueInr)}
                            </div>
                          </td>

                          {/* Risk Index & Tier */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded-lg px-2 py-1 text-[10px] leading-none font-semibold uppercase whitespace-nowrap ${
                                  claim.riskScore.tier === 'investigate'
                                    ? 'bg-app-investigate-soft text-app-investigate'
                                    : claim.riskScore.tier === 'review'
                                    ? 'bg-app-review-soft text-app-review'
                                    : 'bg-app-safe-soft text-app-safe'
                                }`}
                              >
                                {formatRiskPercent(claim.riskScore.composite)} ({claim.riskScore.tier})
                              </span>
                            </div>
                          </td>

                          {/* Pillar Anomaly Flags */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-mono text-[10px]">
                              {gnnCount > 0 && (
                                <span
                                  className="rounded-full bg-app-safe-soft text-app-safe px-2 py-0.5 font-semibold"
                                  title="Precomputed risk signal"
                                >
                                  Signal:{gnnCount}
                                </span>
                              )}
                              {claim.rulesFired && claim.rulesFired.length > 0 && (
                                <span
                                  className="rounded-full bg-app-primary-soft text-app-primary px-2 py-0.5 font-semibold"
                                  title={`Rules: ${claim.rulesFired.join(', ')}`}
                                >
                                  Logic:{claim.rulesFired.length}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Inspect Action */}
                          <td className="py-3 px-4 text-right pr-5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => { setActiveTab('claims'); selectClaim(claim.metadata.claimId); }}
                              className="rounded-full border border-app-line bg-app-panel px-2.5 py-1 text-[10px] font-medium text-app-muted whitespace-nowrap hover:border-app-primary hover:bg-app-primary-soft hover:text-app-primary transition-colors"
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-app-line bg-app-panel px-4 py-3 text-xs text-app-muted">
                  <span>{filteredClaims.length ? `${tablePage * pageSize + 1}–${Math.min((tablePage + 1) * pageSize, filteredClaims.length)} of ${filteredClaims.length.toLocaleString('en-IN')}` : '0 claims'}</span>
                  <div className="flex gap-2"><button disabled={tablePage === 0} onClick={() => setTablePage((page) => Math.max(0, page - 1))} className="rounded-full border border-app-line px-3 py-1 disabled:opacity-40">Previous</button><button disabled={(tablePage + 1) * pageSize >= filteredClaims.length} onClick={() => setTablePage((page) => page + 1)} className="rounded-full border border-app-line px-3 py-1 disabled:opacity-40">Next</button></div>
                </div>
              </div>
            )}
          </main>

          {/* ── 4. RIGHT PANE: DETAIL INSPECTOR ─────────────────────────────────── */}
          {state.isDetailPanelOpen && (
            <aside className="claim-inspector w-1/2 min-w-[480px] max-w-2xl border-l border-app-line bg-app-panel flex flex-col overflow-y-auto">
              {selectedClaim ? (
                <div className="flex flex-col flex-1">
                  {/* Claim Inspector Header */}
                  <div className="px-6 py-5 border-b border-app-line">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-mono text-base font-bold text-app-ink">
                            {selectedClaim.metadata.claimId}
                          </h3>
                          <span
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                              selectedClaim.riskScore.tier === 'investigate'
                                ? 'bg-app-investigate text-white'
                                : selectedClaim.riskScore.tier === 'review'
                                ? 'bg-app-review text-white'
                                : 'bg-app-safe text-white'
                            }`}
                          >
                            {selectedClaim.riskScore.tier} Tier
                          </span>
                        </div>
                        <p className="text-[11px] text-app-muted mt-1.5 font-mono">
                          Policy: {selectedClaim.metadata.policyNumber} ({selectedClaim.metadata.policyType})
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => togglePinClaim(selectedClaim.metadata.claimId)}
                          className="p-1.5 text-app-muted hover:text-app-review rounded-lg hover:bg-app-canvas"
                          title="Pin Claim"
                        >
                          <Pin
                            size={16}
                            className={selectedClaim.isPinned ? 'fill-app-review text-app-review' : ''}
                          />
                        </button>
                        <button
                          onClick={() => toggleDetailPanel(false)}
                          className="p-1.5 text-app-muted hover:text-app-ink rounded-lg hover:bg-app-canvas"
                          title="Close Inspector"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Quick Metadata Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-app-line text-xs">
                      <div>
                        <span className="text-[10px] text-app-muted uppercase block mb-0.5 tracking-wider">Producer</span>
                        <span className="font-semibold text-app-ink">{selectedClaim.metadata.farmerName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-app-muted uppercase block mb-0.5 tracking-wider">Assessor</span>
                        <span className="font-semibold text-app-ink">{selectedClaim.metadata.assessorName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-app-muted uppercase block mb-0.5 tracking-wider">Indemnity Claim</span>
                        <span className="font-mono font-bold text-app-investigate">{formatInr(selectedClaim.metadata.claimAmountInr)}</span>
                      </div>
                      <div><span className="text-[10px] text-app-muted uppercase block mb-0.5 tracking-wider">Reported Loss</span><span className="font-semibold">{selectedClaim.metadata.claimedDamagePct}% · {selectedClaim.metadata.perilType}</span></div>
                      <div><span className="text-[10px] text-app-muted uppercase block mb-0.5 tracking-wider">Farm Location</span><span className="font-semibold">{selectedClaim.metadata.parcel.taluka}, {selectedClaim.metadata.parcel.district}</span></div>
                      <div><span className="text-[10px] text-app-muted uppercase block mb-0.5 tracking-wider">Area / Weather Zone</span><span className="font-semibold">{selectedClaim.metadata.parcel.insuredAcres} ac · {selectedClaim.metadata.parcel.cluTractId}</span></div>
                      <div><span className="text-[10px] text-app-muted uppercase block mb-0.5 tracking-wider">Reported / Inspected</span><span className="font-mono">{selectedClaim.metadata.lossReportDate} / {selectedClaim.metadata.inspectionDate}</span></div>
                    </div>
                  </div>

                  {/* Risk Breakdown: precomputed score + symbolic logic */}
                  <div className="px-6 py-5 space-y-4 border-b border-app-line">
                    <h4 className="font-heading text-sm font-semibold text-app-ink">
                      Risk Engine Breakdown
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      {/* GNN Score Card */}
                      <div className="rounded-2xl border border-app-line bg-app-panel p-4 text-center shadow-[0_4px_18px_rgba(24,40,28,0.035)]">
                        <div className="w-1 h-6 bg-app-safe rounded-full mx-auto mb-2"></div>
                        <span className="text-[10px] font-semibold text-app-safe uppercase block tracking-wider">
                          Graph Risk Score
                        </span>
                        <span className="font-mono text-xl font-bold text-app-ink mt-1 block">
                          {formatRiskPercent(selectedClaim.riskScore.pillars.gnn.raw)}
                        </span>
                        <div className="w-full bg-app-panel-soft h-1 rounded-full mt-3 overflow-hidden">
                          <div
                            className="bg-app-safe h-full rounded-full"
                            style={{ width: `${selectedClaim.riskScore.pillars.gnn.raw * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Symbolic Inference Rules Card */}
                      <div className="rounded-2xl border border-app-line bg-app-panel p-4 text-center shadow-[0_4px_18px_rgba(24,40,28,0.035)]">
                        <div className="w-1 h-6 bg-app-primary-fill rounded-full mx-auto mb-2"></div>
                        <span className="text-[10px] font-semibold text-app-primary uppercase block tracking-wider">
                          Symbolic Proof
                        </span>
                        <span className="font-mono text-xl font-bold text-app-ink mt-1 block">
                          {selectedClaim.rulesFired?.length || 0} Rules
                        </span>
                        <span className="text-[10px] text-app-muted font-mono block mt-2 truncate">
                          {selectedClaim.rulesFired && selectedClaim.rulesFired.length > 0
                            ? selectedClaim.rulesFired.slice(0, 2).join(', ')
                            : 'Laws of inference'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5 space-y-3 border-b border-app-line">
                    <div className="flex items-center justify-between">
                      <h4 className="font-heading text-sm font-semibold text-app-ink">Discrete Mathematics proof trace</h4>
                      <span className="text-[10px] text-app-muted">Premise-based deductions</span>
                    </div>
                    {selectedClaim.proofTrace.length ? <ol className="space-y-2">{selectedClaim.proofTrace.map((step, index) => <li key={`${index}-${step}`} className="flex gap-3 rounded-lg bg-app-canvas p-3 text-xs leading-relaxed text-app-muted"><span className="font-mono font-bold text-app-primary">{String(index + 1).padStart(2, '0')}</span><span>{step}</span></li>)}</ol> : <p className="rounded-lg bg-app-canvas p-3 text-xs text-app-muted">No configured inference rule fired. This is not a proof that the claim is risk-free.</p>}
                  </div>

                  {/* Anomaly Explainability Cards */}
                  <div className="px-6 py-5 space-y-4 border-b border-app-line">
                    <div className="flex items-center justify-between">
                      <h4 className="font-heading text-sm font-semibold text-app-ink">
                        Explainable Findings ({selectedClaim.anomalies.length})
                      </h4>
                      <span className="text-[11px] font-mono text-app-safe font-bold">
                        Risk score
                      </span>
                    </div>

                    <div className="space-y-3">
                      {selectedClaim.anomalies.map((anomaly, idx) => (
                        <div
                          key={idx}
                          className={`rounded-xl p-4 text-xs space-y-2 border-l-[3px] ${
                            anomaly.severity === 'critical'
                              ? 'border-l-app-investigate bg-app-investigate-soft'
                              : anomaly.severity === 'high'
                              ? 'border-l-app-review bg-app-review-soft'
                              : 'border-l-app-line bg-app-canvas'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-app-safe-soft text-app-safe">
                              Risk score • {anomaly.severity}
                            </span>
                          </div>

                          <h5 className="font-heading font-bold text-app-ink text-sm">
                            {anomaly.title}
                          </h5>

                          <p className="text-app-muted leading-relaxed">
                            {anomaly.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Investigator Notes Form */}
                  <div className="px-6 py-5 space-y-3">
                    <label className="font-heading text-sm font-bold text-app-ink block">
                      SIU Investigator Field Notes
                    </label>
                    <textarea
                      rows={3}
                      value={selectedClaim.investigatorNotes}
                      onChange={(e) =>
                        setInvestigatorNotes(selectedClaim.metadata.claimId, e.target.value)
                      }
                      placeholder="Add case notes for this claim..."
                      className="w-full rounded-xl border border-app-line p-3 text-xs text-app-ink placeholder-app-muted focus:border-app-primary focus:outline-none focus:ring-1 focus:ring-app-primary"
                    ></textarea>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 p-12 text-center text-app-muted">
                  <Eye size={36} className="mb-3 text-app-subtle" />
                  <p className="font-heading text-base font-semibold text-app-ink">No claim selected for inspection.</p>
                  <p className="text-xs mt-1 text-app-muted">
                    Select any claim from the table on the left to view detailed risk breakdown and explainability findings.
                  </p>
                </div>
              )}
            </aside>
          )}

          {/* Network Graph Slide panel if toggled */}
          {state.isNetworkPanelOpen && !state.isDetailPanelOpen && (
            <aside className="claim-inspector w-1/2 min-w-[480px] border-l border-app-line bg-app-canvas text-app-ink flex flex-col p-2">
              <NetworkGraphPanel />
            </aside>
          )}

        </div>
        </>}
      </div>
    </div>
  );
}
