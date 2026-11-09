import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Sliders,
} from 'lucide-react';
import {
  DATA_CLARIFICATION_NOTES,
  DIRECTED_TELEPORT_ROUTES,
  MAP_ASSETS,
  TeleportNode,
} from '../data/lineage2MapData';
import {
  computeSingleSourceShortestPaths,
  formatAdena,
  getAllowedOrigins,
} from '../utils/pathfinding';

interface SecondaryViewsProps {
  activeTab: 'matrix' | 'directory' | 'notes';
  nodes: TeleportNode[];
  nodesMap: Record<string, TeleportNode>;
  includeCustodians: boolean;
  calibrationMode: boolean;
  onSelectRouteAndSwitchToMap: (originId: string, destinationId: string) => void;
  onSelectOriginAndSwitchToMap: (originId: string) => void;
  onToggleCalibrationMode: () => void;
  onResetCoordinates: () => void;
}

export const SecondaryViews: React.FC<SecondaryViewsProps> = ({
  activeTab,
  nodes,
  nodesMap,
  includeCustodians,
  calibrationMode,
  onSelectRouteAndSwitchToMap,
  onSelectOriginAndSwitchToMap,
  onToggleCalibrationMode,
  onResetCoordinates,
}) => {
  const [copiedJson, setCopiedJson] = useState(false);
  const [selectedSourceImage, setSelectedSourceImage] = useState<
    '178' | '179' | 'aden' | 'elmore'
  >('178');

  const origins = useMemo(() => getAllowedOrigins(nodes), [nodes]);

  const matrixDestinations = useMemo(() => {
    return nodes.filter(
      (n) =>
        n.category === 'gatekeeper' || n.category === 'one_way_destination'
    );
  }, [nodes]);

  // All-pairs shortest path lookup for the matrix
  const allPairsMatrix = useMemo(() => {
    const map = new Map<string, Map<string, { cost: number; hops: number }>>();
    for (const orig of origins) {
      const paths = computeSingleSourceShortestPaths(
        orig.id,
        includeCustodians,
        nodesMap
      );
      const inner = new Map<string, { cost: number; hops: number }>();
      for (const [destId, route] of paths.entries()) {
        inner.set(destId, { cost: route.totalCost, hops: route.hopCount });
      }
      map.set(orig.id, inner);
    }
    return map;
  }, [origins, includeCustodians, nodesMap]);

  const handleCopyCoordinatesJson = () => {
    const exportData = nodes
      .filter((n) => n.category !== 'landmark')
      .map((n) => ({
        id: n.id,
        name: n.name,
        region: n.region,
        localPctX: n.localPctX,
        localPctY: n.localPctY,
        gridRef: n.gridRef,
      }));
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleDownloadStandaloneJson = () => {
    const payload = {
      game: 'Lineage II Chronicle 1 (Harbingers of War)',
      nodes: nodes.filter((n) => n.category !== 'landmark'),
      routes: DIRECTED_TELEPORT_ROUTES,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lineage2-c1-teleports.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (activeTab === 'matrix') {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-[#0e1015]">
        <div className="max-w-[1400px] mx-auto space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#252a36] pb-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#f3efe6]">
                All-Pairs Cheapest Adena Teleport Matrix
              </h1>
              <p className="text-sm text-[#9c9689] mt-1 max-w-2xl">
                Every cell displays the minimum total Adena cost (in thousands or exact Adena) and hop count from the row Origin to the column Destination. Click any cell to visualize that route on the interactive map.
              </p>
            </div>
            <div className="text-xs text-[#9c9689] flex items-center gap-4">
              <span>
                <strong className="text-[#f5dfa0]">Gold</strong> = Direct 1-Hop Route
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-[#cbd5e1]">Silver</strong> = Multi-Hop Route
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#252a36] rounded-lg bg-[#12151c]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#252a36] bg-[#161a24]">
                  <th className="sticky left-0 z-10 bg-[#161a24] p-3 font-semibold text-[#f3efe6] border-r border-[#252a36] min-w-[170px]">
                    Origin ↓ \ Destination →
                  </th>
                  {matrixDestinations.map((dest) => (
                    <th
                      key={dest.id}
                      className="p-2.5 font-medium text-[#c7c2b8] border-r border-[#1f2430] min-w-[105px] align-bottom"
                    >
                      <div className="leading-tight">{dest.name}</div>
                      <div className="text-[10px] font-normal text-[#7e786d] mt-0.5">
                        {dest.category === 'one_way_destination'
                          ? '1-Way Drop'
                          : dest.gridRef}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2430]">
                {origins.map((orig) => {
                  const rowMap = allPairsMatrix.get(orig.id);
                  return (
                    <tr
                      key={orig.id}
                      className="hover:bg-[#181d28] transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-[#12151c] p-3 font-semibold text-[#ebe6dc] border-r border-[#252a36] whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectOriginAndSwitchToMap(orig.id)}
                          className="hover:text-[#d4a853] transition-colors text-left"
                        >
                          <div>{orig.name}</div>
                          <div className="text-[10px] font-normal text-[#8c867a]">
                            {orig.gatekeeper}
                          </div>
                        </button>
                      </td>
                      {matrixDestinations.map((dest) => {
                        if (orig.id === dest.id) {
                          return (
                            <td
                              key={dest.id}
                              className="p-2.5 text-center font-mono text-[#525866] bg-[#0c0e13] border-r border-[#1f2430]"
                            >
                              —
                            </td>
                          );
                        }
                        const cell = rowMap?.get(dest.id);
                        if (!cell) {
                          return (
                            <td
                              key={dest.id}
                              className="p-2.5 text-center font-mono text-[#525866] border-r border-[#1f2430]"
                            >
                              N/A
                            </td>
                          );
                        }
                        const isDirect = cell.hops === 1;
                        return (
                          <td
                            key={dest.id}
                            onClick={() =>
                              onSelectRouteAndSwitchToMap(orig.id, dest.id)
                            }
                            className="p-2 text-right font-mono tabular-nums border-r border-[#1f2430] cursor-pointer hover:bg-[#222a3a] transition-colors group"
                            title={`${orig.name} → ${dest.name}: ${formatAdena(cell.cost)} (${cell.hops} ${cell.hops === 1 ? 'hop' : 'hops'})`}
                          >
                            <div
                              className={`font-semibold ${
                                isDirect
                                  ? 'text-[#f5dfa0] group-hover:text-white'
                                  : 'text-[#cbd5e1] group-hover:text-[#38bdf8]'
                              }`}
                            >
                              {cell.cost.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-[#7e786d]">
                              {isDirect ? 'Direct' : `${cell.hops} hops`}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'directory') {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-[#0e1015]">
        <div className="max-w-[1360px] mx-auto space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#252a36] pb-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#f3efe6]">
                Chronicle 1 Gatekeeper & Custodian Price Directory
              </h1>
              <p className="text-sm text-[#9c9689] mt-1 max-w-2xl">
                Complete transcription of all 51 Gatekeeper routes and 11 Clan Hall Custodian routes from the Prima Official Game Guide (pages 176–177), cross-referenced with the world maps.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Cols: Gatekeeper Cards */}
            <div className="lg:col-span-7 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {origins.map((origin) => {
                  const directEdges = DIRECTED_TELEPORT_ROUTES.filter(
                    (e) => e.from === origin.id && !e.isCustodian
                  );
                  const custodianEdges = DIRECTED_TELEPORT_ROUTES.filter(
                    (e) => e.from === origin.id && e.isCustodian
                  );

                  return (
                    <div
                      key={origin.id}
                      className="p-4 rounded-lg bg-[#12151c] border border-[#252a36] flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 border-b border-[#222733] pb-2">
                          <div>
                            <h3 className="font-display text-sm font-bold text-[#f3efe6]">
                              {origin.name}
                            </h3>
                            <div className="text-xs text-[#9c9689] mt-0.5">
                              <span>{origin.gatekeeper}</span>
                              <span aria-hidden="true"> · </span>
                              <span>{origin.gridRef}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onSelectOriginAndSwitchToMap(origin.id)
                            }
                            className="text-xs text-[#d4a853] hover:underline whitespace-nowrap shrink-0 flex items-center gap-1"
                          >
                            View on Map
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="mt-2.5 divide-y divide-[#1c202b]">
                          {directEdges.map((edge) => (
                            <button
                              key={edge.id}
                              type="button"
                              onClick={() =>
                                onSelectRouteAndSwitchToMap(edge.from, edge.to)
                              }
                              className="w-full py-1.5 flex items-center justify-between gap-2 text-xs hover:text-[#38bdf8] transition-colors text-left"
                            >
                              <span className="text-[#d6d1c7] truncate">
                                {edge.bookDestinationLabel}
                                {edge.isOneWay ? (
                                  <span className="ml-1.5 text-[10px] text-[#fca5a5]">
                                    · 1-Way
                                  </span>
                                ) : null}
                              </span>
                              <span className="font-mono tabular-nums font-semibold text-[#f5dfa0] shrink-0">
                                {edge.cost.toLocaleString()} a
                              </span>
                            </button>
                          ))}
                        </div>

                        {custodianEdges.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[#252a36]">
                            <div className="text-[11px] font-medium text-emerald-300 mb-1">
                              {origin.custodians} (Clan Hall)
                            </div>
                            <div className="divide-y divide-[#1c202b]">
                              <div className="py-1 flex items-center justify-between text-xs text-[#8c867a]">
                                <span>Village square or gates</span>
                                <span className="font-mono">free</span>
                              </div>
                              {custodianEdges.map((edge) => (
                                <button
                                  key={edge.id}
                                  type="button"
                                  onClick={() =>
                                    onSelectRouteAndSwitchToMap(
                                      edge.from,
                                      edge.to
                                    )
                                  }
                                  className="w-full py-1 flex items-center justify-between gap-2 text-xs text-[#a7f3d0] hover:underline text-left"
                                >
                                  <span className="truncate">
                                    {edge.bookDestinationLabel}
                                  </span>
                                  <span className="font-mono tabular-nums shrink-0">
                                    {edge.cost} a
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 5 Cols: Original Uploaded Reference Scans Inspector */}
            <div className="lg:col-span-5 bg-[#12151c] border border-[#252a36] rounded-lg p-4 space-y-3 sticky top-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-[#f3efe6]">
                  Uploaded Source Files Inspector
                </h3>
                <div className="flex items-center gap-1 bg-[#0b0d12] p-0.5 rounded border border-[#252a36] text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedSourceImage('178')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                      selectedSourceImage === '178'
                        ? 'bg-[#232938] text-[#f5dfa0]'
                        : 'text-[#8c867a]'
                    }`}
                  >
                    178.webp (Prices)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSourceImage('179')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                      selectedSourceImage === '179'
                        ? 'bg-[#232938] text-[#f5dfa0]'
                        : 'text-[#8c867a]'
                    }`}
                  >
                    179.webp (Arrows)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSourceImage('aden')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                      selectedSourceImage === 'aden'
                        ? 'bg-[#232938] text-[#f5dfa0]'
                        : 'text-[#8c867a]'
                    }`}
                  >
                    aden-c1.jpg
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSourceImage('elmore')}
                    className={`px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                      selectedSourceImage === 'elmore'
                        ? 'bg-[#232938] text-[#f5dfa0]'
                        : 'text-[#8c867a]'
                    }`}
                  >
                    elmore-c1.jpg
                  </button>
                </div>
              </div>

              <div className="rounded border border-[#252a36] overflow-hidden bg-[#0a0c10] max-h-[680px] overflow-y-auto">
                <img
                  src={
                    selectedSourceImage === '178'
                      ? MAP_ASSETS.priceTableRefUrl
                      : selectedSourceImage === '179'
                      ? MAP_ASSETS.diagramRefUrl
                      : selectedSourceImage === 'aden'
                      ? MAP_ASSETS.adenMapUrl
                      : MAP_ASSETS.elmoreMapUrl
                  }
                  alt={`Uploaded reference file ${selectedSourceImage}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // activeTab === 'notes'
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0e1015]">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="border-b border-[#252a36] pb-4">
          <h1 className="font-display text-2xl font-bold text-[#f3efe6]">
            Dataset Verification, Discrepancy Notes & GitHub Pages Export
          </h1>
          <p className="text-sm text-[#9c9689] mt-1">
            All 51 Gatekeeper routes and 11 Clan Hall Custodian routes from the 4 uploaded files have been reconciled. Below are the exact nuances found across the files and tools to export or fine-tune coordinates for GitHub Pages.
          </p>
        </div>

        {/* 5 Reconciliation Notes */}
        <div className="space-y-4">
          <h2 className="font-display text-base font-semibold text-[#f3efe6]">
            Cross-File Findings & Clarifications
          </h2>
          <div className="space-y-3">
            {DATA_CLARIFICATION_NOTES.map((note, index) => (
              <div
                key={note.id}
                className="p-4 rounded-lg bg-[#12151c] border border-[#252a36] space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#f3efe6]">
                    0{index + 1}. {note.title}
                  </h3>
                  <span className="text-xs text-[#d4a853] font-mono">
                    {note.status === 'resolved'
                      ? 'Verified 100%'
                      : note.status === 'inferred_from_diagram'
                      ? 'Mapped from 179.webp'
                      : 'Toggleable Layer'}
                  </span>
                </div>
                <div className="text-xs font-medium text-[#cbd5e1]">
                  {note.summary}
                </div>
                <p className="text-xs text-[#9c9689] leading-relaxed">
                  {note.details}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pin Calibration & Static JSON Export for GitHub.io */}
        <div className="p-5 rounded-lg bg-[#12151c] border border-[#252a36] space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#f3efe6]">
                GitHub Pages Hosting & Coordinate Calibration
              </h2>
              <p className="text-xs text-[#9c9689] mt-1 max-w-xl leading-relaxed">
                This application runs 100% client-side in JavaScript with zero server dependencies—ready to deploy directly to <code className="text-[#f5dfa0]">github.io</code> via <code className="text-[#f5dfa0]">npm run build</code>. If you want to adjust any unlabeled road drop-off pin, enable Pin Calibration Mode and drag pins directly on the map.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onToggleCalibrationMode}
                className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  calibrationMode
                    ? 'bg-[#d4a853] text-[#0e1015] border-[#f5dfa0] font-semibold'
                    : 'bg-[#181c26] hover:bg-[#232938] text-[#ebe6dc] border-[#2e3546]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                {calibrationMode
                  ? 'Calibration Mode: Active (Drag Pins on Map)'
                  : 'Enable Pin Drag Calibration'}
              </button>

              <button
                type="button"
                onClick={onResetCoordinates}
                className="px-3 py-2 rounded-md text-xs font-medium bg-[#181c26] hover:bg-[#232938] text-[#c7c2b8] border border-[#2e3546] transition-colors whitespace-nowrap shrink-0"
              >
                Reset Default Coordinates
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#222733] flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopyCoordinatesJson}
              className="px-3.5 py-2 rounded-md text-xs font-medium bg-[#1d2432] hover:bg-[#263042] text-[#f3efe6] border border-[#323c52] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied Coordinates JSON
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Node Coordinates JSON
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadStandaloneJson}
              className="px-3.5 py-2 rounded-md text-xs font-medium bg-[#181c26] hover:bg-[#232938] text-[#d6d1c7] border border-[#2e3546] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download Full Route Graph (.json)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
