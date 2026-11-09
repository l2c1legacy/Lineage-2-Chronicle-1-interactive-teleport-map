import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  Compass,
  RotateCcw,
  Search,
} from 'lucide-react';
import { TeleportNode } from '../data/lineage2MapData';
import {
  ComputedRoute,
  DestinationReachability,
  findNearestTeleportNode,
  findTopRoutesBetween,
  formatAdena,
  getAllowedOrigins,
} from '../utils/pathfinding';

interface RoutePlannerSidebarProps {
  nodes: TeleportNode[];
  nodesMap: Record<string, TeleportNode>;
  originId: string | null;
  destinationId: string | null;
  selectedRouteIndex: number;
  includeCustodians: boolean;
  reachabilityMap: Map<string, DestinationReachability>;
  onSelectOrigin: (nodeId: string) => void;
  onSelectDestination: (nodeId: string | null) => void;
  onSelectRouteIndex: (idx: number) => void;
  onHoverNode: (nodeId: string | null) => void;
  onSwapOriginDestination: () => void;
  onResetAll: () => void;
}

export const RoutePlannerSidebar: React.FC<RoutePlannerSidebarProps> = ({
  nodes,
  nodesMap,
  originId,
  destinationId,
  selectedRouteIndex,
  includeCustodians,
  reachabilityMap,
  onSelectOrigin,
  onSelectDestination,
  onSelectRouteIndex,
  onHoverNode,
  onSwapOriginDestination,
  onResetAll,
}) => {
  const [destFilter, setDestFilter] = useState<'all' | 'direct' | 'multihop'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'cost' | 'name' | 'hops'>('cost');

  const allowedOrigins = useMemo(() => getAllowedOrigins(nodes), [nodes]);

  const originNode = originId ? nodesMap[originId] : null;
  const rawDestNode = destinationId ? nodesMap[destinationId] : null;

  // If the user selected a non-teleport landmark, resolve its nearest teleport node
  const landmarkNearestInfo = useMemo(() => {
    if (!rawDestNode || rawDestNode.category !== 'landmark') return null;
    return findNearestTeleportNode(rawDestNode, includeCustodians, nodesMap);
  }, [rawDestNode, includeCustodians, nodesMap]);

  const effectiveDestinationId = useMemo(() => {
    if (!rawDestNode) return null;
    if (rawDestNode.category === 'landmark') {
      return landmarkNearestInfo?.nearestNode.id || null;
    }
    return rawDestNode.id;
  }, [rawDestNode, landmarkNearestInfo]);

  // Compute top alternative routes when both origin & destination are chosen
  const topRoutes: ComputedRoute[] = useMemo(() => {
    if (!originId || !effectiveDestinationId || originId === effectiveDestinationId) {
      return [];
    }
    return findTopRoutesBetween(
      originId,
      effectiveDestinationId,
      includeCustodians,
      6,
      nodesMap
    );
  }, [originId, effectiveDestinationId, includeCustodians, nodesMap]);

  const activeRoute =
    topRoutes[Math.min(selectedRouteIndex, Math.max(0, topRoutes.length - 1))] ||
    null;

  // Return cost info for the selected destination
  const selectedDestReachability = effectiveDestinationId
    ? reachabilityMap.get(effectiveDestinationId)
    : undefined;

  // List of all reachable destinations from the current origin
  const reachableList = useMemo(() => {
    if (!originId) return [];
    const items = Array.from(reachabilityMap.values()).filter((item) => {
      const node = nodesMap[item.destinationId];
      if (!node) return false;
      if (destFilter === 'direct' && item.directCost === null) return false;
      if (destFilter === 'multihop' && item.directCost !== null) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          node.name.toLowerCase().includes(q) ||
          node.bookName.toLowerCase().includes(q) ||
          (node.gatekeeper && node.gatekeeper.toLowerCase().includes(q))
        );
      }
      return true;
    });

    items.sort((a, b) => {
      if (sortBy === 'cost') {
        return a.minCost - b.minCost || a.hopCount - b.hopCount;
      }
      if (sortBy === 'hops') {
        return a.hopCount - b.hopCount || a.minCost - b.minCost;
      }
      const nameA = nodesMap[a.destinationId]?.name || '';
      const nameB = nodesMap[b.destinationId]?.name || '';
      return nameA.localeCompare(nameB);
    });

    return items;
  }, [originId, reachabilityMap, nodesMap, destFilter, searchQuery, sortBy]);

  const canSwap = Boolean(
    originNode &&
      rawDestNode &&
      rawDestNode.category === 'gatekeeper' &&
      originNode.id !== rawDestNode.id
  );

  // Selectable destinations for the dropdown
  const selectableDestinations = useMemo(() => {
    return nodes.filter((n) => {
      if (n.id === originId) return false;
      if (n.category === 'custodian_destination' && !includeCustodians) return false;
      if (n.category === 'landmark') return false;
      return true;
    });
  }, [nodes, originId, includeCustodians]);

  return (
    <aside className="w-full lg:w-[430px] xl:w-[460px] shrink-0 bg-[#12151c] border-l border-[#252a36] flex flex-col h-full overflow-hidden">
      {/* Top Route Selectors Box */}
      <div className="p-4 border-b border-[#252a36] bg-[#151922]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display text-sm font-bold tracking-wide text-[#f3efe6]">
            Teleport Route Calculator
          </h2>
          {(originId || destinationId) && (
            <button
              type="button"
              onClick={onResetAll}
              className="px-2.5 py-1 rounded text-xs font-medium text-[#c7c2b8] hover:text-[#ebe6dc] bg-[#1d222e] hover:bg-[#262d3d] border border-[#2e3546] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        {/* Origin & Destination Form Controls */}
        <div className="space-y-2.5">
          {/* Origin Selector */}
          <div>
            <label
              htmlFor="origin-select"
              className="block text-xs text-[#9c9689] mb-1"
            >
              Origin Point (15 Gatekeeper Towns)
            </label>
            <select
              id="origin-select"
              value={originId || ''}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectOrigin(e.target.value);
                } else {
                  onResetAll();
                }
              }}
              className="w-full px-3 py-2 rounded-md bg-[#0d1016] border border-[#2c3344] text-sm text-[#ebe6dc] focus:outline-none focus:border-[#d4a853]"
            >
              <option value="">Select an Origin Town on Map...</option>
              <optgroup label="Kingdom of Aden (13 Gatekeepers)">
                {allowedOrigins
                  .filter((n) => n.region === 'aden')
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.gatekeeper?.replace('Gatekeeper ', 'GK ')})
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Kingdom of Elmore (2 Gatekeepers)">
                {allowedOrigins
                  .filter((n) => n.region === 'elmore')
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.gatekeeper?.replace('Gatekeeper ', 'GK ')})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Swap + Destination Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="dest-select"
                className="block text-xs text-[#9c9689]"
              >
                Destination Point
              </label>
              <button
                type="button"
                disabled={!canSwap}
                onClick={onSwapOriginDestination}
                className={`text-xs flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                  canSwap
                    ? 'text-[#d4a853] hover:text-[#f5dfa0] cursor-pointer'
                    : 'text-[#525866] cursor-not-allowed'
                }`}
                title="Swap Origin and Destination"
              >
                <ArrowUpDown className="w-3 h-3" />
                Reverse Route
              </button>
            </div>
            <select
              id="dest-select"
              value={destinationId || ''}
              disabled={!originId}
              onChange={(e) =>
                onSelectDestination(e.target.value ? e.target.value : null)
              }
              className="w-full px-3 py-2 rounded-md bg-[#0d1016] border border-[#2c3344] text-sm text-[#ebe6dc] disabled:opacity-50 focus:outline-none focus:border-[#38bdf8]"
            >
              <option value="">
                {originId
                  ? 'All Destinations (Click a pin or choose below)...'
                  : 'Select an Origin first...'}
              </option>
              <optgroup label="Gatekeeper Towns (Two-Way Capable)">
                {selectableDestinations
                  .filter((n) => n.category === 'gatekeeper')
                  .map((n) => {
                    const r = reachabilityMap.get(n.id);
                    return (
                      <option key={n.id} value={n.id}>
                        {n.name}
                        {r ? ` — ${formatAdena(r.minCost)} (${r.hopCount === 1 ? 'Direct' : `${r.hopCount} hops`})` : ''}
                      </option>
                    );
                  })}
              </optgroup>
              <optgroup label="One-Way Hunting Drop-offs">
                {selectableDestinations
                  .filter((n) => n.category === 'one_way_destination')
                  .map((n) => {
                    const r = reachabilityMap.get(n.id);
                    return (
                      <option key={n.id} value={n.id}>
                        {n.name}
                        {r ? ` — ${formatAdena(r.minCost)} (1-Way)` : ''}
                      </option>
                    );
                  })}
              </optgroup>
              {includeCustodians && (
                <optgroup label="Clan Hall Custodian Drop-offs (500a)">
                  {selectableDestinations
                    .filter((n) => n.category === 'custodian_destination')
                    .map((n) => {
                      const r = reachabilityMap.get(n.id);
                      return (
                        <option key={n.id} value={n.id}>
                          {n.name}
                          {r ? ` — ${formatAdena(r.minCost)}` : ''}
                        </option>
                      );
                    })}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* CASE 1: No Origin Selected yet */}
        {!originNode && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-[#161a24] border border-[#252a36]">
              <h3 className="font-display text-sm font-semibold text-[#f3efe6] mb-1.5">
                Select an Origin Town to Begin
              </h3>
              <p className="text-xs text-[#a8a296] leading-relaxed">
                Click any of the <strong className="text-[#ebe6dc]">15 Gatekeeper towns</strong> on the world map (or choose from the dropdown above). The map will immediately highlight all reachable destinations and display the exact Adena price for every route.
              </p>
            </div>

            {/* Quick Start Gatekeeper Grid */}
            <div>
              <div className="flex items-center justify-between text-xs text-[#9c9689] mb-2">
                <span>Allowed Origin Points</span>
                <span className="font-mono tabular-nums">15 Gatekeepers</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {allowedOrigins.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onSelectOrigin(node.id)}
                    onMouseEnter={() => onHoverNode(node.id)}
                    onMouseLeave={() => onHoverNode(null)}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#161a24] hover:bg-[#1e2433] border border-[#252a36] hover:border-[#d4a853]/50 transition-colors flex items-center justify-between gap-2 group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#ebe6dc] group-hover:text-[#f5dfa0] truncate">
                        {node.name}
                      </div>
                      <div className="text-[11px] text-[#8c867a] truncate">
                        <span>{node.gatekeeper}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{node.gridRef}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#6e6a61] group-hover:text-[#d4a853] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CASE 2: Both Origin AND Destination Selected -> Detailed Route Breakdown */}
        {originNode && rawDestNode && (
          <div className="space-y-4">
            {/* Back to All Destinations link */}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => onSelectDestination(null)}
                className="text-[#38bdf8] hover:underline font-medium whitespace-nowrap shrink-0"
              >
                ← View all destinations from {originNode.name}
              </button>
              <span className="text-[#8c867a] font-mono tabular-nums">
                {topRoutes.length} {topRoutes.length === 1 ? 'path' : 'paths'} found
              </span>
            </div>

            {/* If user clicked a non-teleport Landmark */}
            {rawDestNode.category === 'landmark' && landmarkNearestInfo && (
              <div className="p-3 rounded-md bg-[#18202c] border border-[#2d3b4e] text-xs text-[#cbd5e1]">
                <div className="font-semibold text-[#f3efe6] mb-0.5">
                  Landmark Selected: {rawDestNode.name}
                </div>
                <p className="text-[#94a3b8]">
                  This hunting ground has no direct teleport receiver. Routing to nearest drop-off:{' '}
                  <strong className="text-[#38bdf8]">
                    {landmarkNearestInfo.nearestNode.name}
                  </strong>
                  .
                </p>
              </div>
            )}

            {/* Primary Cheapest / Selected Route Card */}
            {activeRoute ? (
              <div className="p-4 rounded-lg bg-[#161a24] border border-[#2e3646] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#9c9689]">
                      {activeRoute.isCheapest
                        ? 'Optimal Cheapest Route'
                        : `Selected Alternative (+${formatAdena(activeRoute.deltaFromCheapest)})`}
                    </div>
                    <div className="text-sm font-semibold text-[#f3efe6] mt-0.5">
                      {originNode.name} → {nodesMap[effectiveDestinationId!]?.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xl font-bold text-[#f5dfa0] tabular-nums">
                      {formatAdena(activeRoute.totalCost)}
                    </div>
                    <div className="text-[11px] text-[#9c9689] font-mono tabular-nums">
                      {activeRoute.hopCount === 1
                        ? 'Direct (1 hop)'
                        : `${activeRoute.hopCount} hops`}
                    </div>
                  </div>
                </div>

                {/* Clean unboxed metadata summary */}
                <div className="pt-2 border-t border-[#252a36] flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#a8a296]">
                  <span>
                    {activeRoute.hasOneWaySegment
                      ? 'Contains 1-Way Teleport'
                      : 'All 2-Way Segments'}
                  </span>
                  <span aria-hidden="true">·</span>
                  {selectedDestReachability?.returnMinCost !== null &&
                  selectedDestReachability?.returnMinCost !== undefined ? (
                    <span className="font-mono tabular-nums">
                      Return: {formatAdena(selectedDestReachability.returnMinCost)} (Round-trip:{' '}
                      {formatAdena(
                        activeRoute.totalCost + selectedDestReachability.returnMinCost
                      )}
                      )
                    </span>
                  ) : (
                    <span className="text-[#fca5a5]">
                      1-Way Dead End (No Return Gatekeeper)
                    </span>
                  )}
                </div>

                {/* Step-by-Step Hop Itinerary */}
                <div className="pt-2 space-y-2">
                  <div className="text-xs font-medium text-[#c7c2b8]">
                    Step-by-Step Gatekeeper Itinerary
                  </div>
                  <div className="divide-y divide-[#232834] border border-[#252a36] rounded-md bg-[#0f1219]">
                    {activeRoute.hops.map((hop, idx) => (
                      <div
                        key={`${hop.edgeId}-${idx}`}
                        className="p-2.5 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-medium text-[#ebe6dc]">
                            <span className="font-mono text-[#38bdf8] mr-1.5 tabular-nums">
                              0{idx + 1}.
                            </span>
                            {hop.fromName} → {hop.toName}
                          </div>
                          <div className="text-[11px] text-[#8c867a]">
                            <span>Speak to {hop.gatekeeper}</span>
                            <span aria-hidden="true"> · </span>
                            <span>Select &ldquo;{hop.bookDestinationLabel}&rdquo;</span>
                          </div>
                          {hop.isOneWay && (
                            <div className="text-[11px] text-[#fca5a5]">
                              1-Way Teleport (cannot return the same way)
                            </div>
                          )}
                        </div>
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <div className="font-semibold text-[#f5dfa0]">
                            {formatAdena(hop.cost)}
                          </div>
                          {activeRoute.hops.length > 1 && (
                            <div className="text-[10px] text-[#6e6a61]">
                              Σ {formatAdena(hop.cumulativeCost)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#1c1616] border border-[#452323] text-xs text-[#fca5a5]">
                No teleport route exists from {originNode.name} to {rawDestNode.name}.
              </div>
            )}

            {/* Alternative Paths Comparison Table */}
            {topRoutes.length > 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#9c9689]">
                  <span>Compare Viable Paths</span>
                  <span>Click to highlight on map</span>
                </div>
                <div className="space-y-1.5">
                  {topRoutes.map((route, idx) => {
                    const isSelected = idx === selectedRouteIndex;
                    const pathNames = route.nodeIds
                      .map((id) => nodesMap[id]?.name || id)
                      .join(' → ');

                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => onSelectRouteIndex(idx)}
                        className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                          isSelected
                            ? 'bg-[#172130] border-[#38bdf8] text-[#f0f9ff]'
                            : 'bg-[#161a24] hover:bg-[#1b202c] border-[#252a36] text-[#c7c2b8]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                          <span>
                            Option {idx + 1}
                            {route.isCheapest ? ' · Cheapest' : ''}
                            {route.isDirect ? ' · Direct' : ` · ${route.hopCount} Hops`}
                          </span>
                          <span className="font-mono tabular-nums text-[#f5dfa0]">
                            {formatAdena(route.totalCost)}
                            {route.deltaFromCheapest > 0 && (
                              <span className="ml-1.5 text-[11px] font-normal text-[#9c9689]">
                                (+{formatAdena(route.deltaFromCheapest)})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-[#8c867a] leading-snug">
                          {pathNames}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CASE 3: Origin Selected, Showing All Reachable Destinations & Exact Adena Costs */}
        {originNode && !rawDestNode && (
          <div className="space-y-3.5">
            {/* Selected Origin Summary Banner */}
            <div className="p-3.5 rounded-lg bg-[#161a24] border border-[#2e3545]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-[#d4a853] font-medium">
                    Active Origin Point
                  </div>
                  <h3 className="text-base font-bold text-[#f3efe6] mt-0.5">
                    {originNode.name}
                  </h3>
                  <div className="text-xs text-[#9c9689] mt-0.5">
                    <span>{originNode.gatekeeper}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{originNode.gridRef}</span>
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-[#9c9689] tabular-nums">
                  <div>{reachabilityMap.size} reachable</div>
                  <div>
                    {
                      Array.from(reachabilityMap.values()).filter(
                        (r) => r.directCost !== null
                      ).length
                    }{' '}
                    direct
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#a8a296] leading-relaxed">
                {originNode.description}
              </p>
            </div>

            {/* Filter & Sort Controls for Destinations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                {/* Interactive Segmented Filter Control */}
                <div className="flex items-center bg-[#0d1016] p-0.5 rounded-md border border-[#252a36]">
                  <button
                    type="button"
                    onClick={() => setDestFilter('all')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      destFilter === 'all'
                        ? 'bg-[#232938] text-[#ebe6dc]'
                        : 'text-[#8c867a] hover:text-[#ebe6dc]'
                    }`}
                  >
                    All ({reachabilityMap.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestFilter('direct')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      destFilter === 'direct'
                        ? 'bg-[#232938] text-[#f5dfa0]'
                        : 'text-[#8c867a] hover:text-[#ebe6dc]'
                    }`}
                  >
                    Direct Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestFilter('multihop')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      destFilter === 'multihop'
                        ? 'bg-[#232938] text-[#ebe6dc]'
                        : 'text-[#8c867a] hover:text-[#ebe6dc]'
                    }`}
                  >
                    Multi-Hop
                  </button>
                </div>

                {/* Sort selector */}
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as 'cost' | 'name' | 'hops')
                  }
                  aria-label="Sort destinations"
                  className="px-2 py-1 rounded bg-[#0d1016] border border-[#252a36] text-xs text-[#c7c2b8]"
                >
                  <option value="cost">Sort: Cheapest</option>
                  <option value="hops">Sort: Fewest Hops</option>
                  <option value="name">Sort: A–Z</option>
                </select>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6e6a61] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter destinations by town or gatekeeper..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#0d1016] border border-[#252a36] text-xs text-[#ebe6dc] placeholder-[#6e6a61] focus:outline-none focus:border-[#d4a853]"
                />
              </div>
            </div>

            {/* Destination Cost Table */}
            <div className="divide-y divide-[#202531] border border-[#252a36] rounded-lg bg-[#0e1118] overflow-hidden">
              {reachableList.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#8c867a]">
                  No destinations match your current filter.
                </div>
              ) : (
                reachableList.map((item) => {
                  const destNode = nodesMap[item.destinationId];
                  if (!destNode) return null;

                  const isDirect = item.directCost !== null;
                  const viaTowns =
                    item.bestRoute.nodeIds.length > 2
                      ? item.bestRoute.nodeIds
                          .slice(1, -1)
                          .map((id) => nodesMap[id]?.name || id)
                          .join(' → ')
                      : null;

                  return (
                    <button
                      key={item.destinationId}
                      type="button"
                      onClick={() => onSelectDestination(item.destinationId)}
                      onMouseEnter={() => onHoverNode(item.destinationId)}
                      onMouseLeave={() => onHoverNode(null)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#171c28] transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#ebe6dc] group-hover:text-[#38bdf8] truncate">
                          {destNode.name}
                        </div>
                        <div className="text-[11px] text-[#8c867a] truncate mt-0.5">
                          <span>
                            {item.hopCount === 1
                              ? 'Direct teleport'
                              : `${item.hopCount} hops via ${viaTowns}`}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {item.returnMinCost !== null
                              ? `Return: ${formatAdena(item.returnMinCost)}`
                              : '1-Way only'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div
                          className={`text-xs font-semibold ${
                            isDirect ? 'text-[#f5dfa0]' : 'text-[#cbd5e1]'
                          }`}
                        >
                          {formatAdena(item.minCost)}
                        </div>
                        <div className="text-[10px] text-[#6e6a61]">
                          {isDirect ? '1 hop' : `${item.hopCount} hops`}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
