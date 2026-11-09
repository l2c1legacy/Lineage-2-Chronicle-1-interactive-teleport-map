import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Crosshair,
  Eye,
  Grid,
  Layers,
  MapPin,
  Maximize2,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  MAP_ASSETS,
  TeleportNode,
  WORLD_GEOMETRY,
  getVisualTeleportLines,
} from '../data/lineage2MapData';
import {
  ComputedRoute,
  DestinationReachability,
  formatAdena,
} from '../utils/pathfinding';

interface InteractiveWorldMapProps {
  nodes: TeleportNode[];
  nodesMap: Record<string, TeleportNode>;
  originId: string | null;
  destinationId: string | null;
  hoveredNodeId: string | null;
  activeRoute: ComputedRoute | null;
  reachabilityMap: Map<string, DestinationReachability>;
  includeCustodians: boolean;
  showLandmarks: boolean;
  showAllNetworkLines: boolean;
  showGridOverlay: boolean;
  showDirectOnlyOnMap: boolean;
  calibrationMode: boolean;
  clickTargetMode: 'origin' | 'destination';
  onSelectOrigin: (nodeId: string) => void;
  onSelectDestination: (nodeId: string | null) => void;
  onHoverNode: (nodeId: string | null) => void;
  onChangeClickTargetMode: (mode: 'origin' | 'destination') => void;
  onToggleCustodians: () => void;
  onToggleLandmarks: () => void;
  onToggleNetworkLines: () => void;
  onToggleGridOverlay: () => void;
  onToggleDirectOnlyOnMap: () => void;
  onUpdateNodePosition?: (
    nodeId: string,
    localPctX: number,
    localPctY: number
  ) => void;
}

export const InteractiveWorldMap: React.FC<InteractiveWorldMapProps> = ({
  nodes,
  nodesMap,
  originId,
  destinationId,
  hoveredNodeId,
  activeRoute,
  reachabilityMap,
  includeCustodians,
  showLandmarks,
  showAllNetworkLines,
  showGridOverlay,
  showDirectOnlyOnMap,
  calibrationMode,
  clickTargetMode,
  onSelectOrigin,
  onSelectDestination,
  onHoverNode,
  onChangeClickTargetMode,
  onToggleCustodians,
  onToggleLandmarks,
  onToggleNetworkLines,
  onToggleGridOverlay,
  onToggleDirectOnlyOnMap,
  onUpdateNodePosition,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport transform state: x, y in container pixels, scale in world->screen ratio
  const [transform, setTransform] = useState<{
    x: number;
    y: number;
    scale: number;
  }>({
    x: 40,
    y: 20,
    scale: 0.48,
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [imageLoadState, setImageLoadState] = useState<{
    aden: boolean;
    elmore: boolean;
  }>({
    aden: false,
    elmore: false,
  });

  // Fit a specific world bounding box into the viewport
  const fitWorldRect = useCallback(
    (
      rect: { x: number; y: number; width: number; height: number },
      paddingPx = 48
    ) => {
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth || 960;
      const ch = container.clientHeight || 720;

      const scaleX = (cw - paddingPx * 2) / rect.width;
      const scaleY = (ch - paddingPx * 2) / rect.height;
      const nextScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.22), 2.5);

      const nextX = (cw - rect.width * nextScale) / 2 - rect.x * nextScale;
      const nextY = (ch - rect.height * nextScale) / 2 - rect.y * nextScale;

      setTransform({
        x: nextX,
        y: nextY,
        scale: nextScale,
      });
    },
    []
  );

  // Initial fit on mount — focus Aden + Southern Elmore nicely
  useEffect(() => {
    const timer = setTimeout(() => {
      fitWorldRect(
        {
          x: 0,
          y: 0,
          width: WORLD_GEOMETRY.width,
          height: WORLD_GEOMETRY.height,
        },
        28
      );
    }, 50);
    return () => clearTimeout(timer);
  }, [fitWorldRect]);

  const handleFitFullWorld = () => {
    fitWorldRect(
      {
        x: 0,
        y: 0,
        width: WORLD_GEOMETRY.width,
        height: WORLD_GEOMETRY.height,
      },
      28
    );
  };

  const handleFitAden = () => {
    fitWorldRect(WORLD_GEOMETRY.aden, 32);
  };

  const handleFitElmore = () => {
    fitWorldRect(WORLD_GEOMETRY.elmore, 32);
  };

  const handleFitActiveRoute = () => {
    if (!activeRoute || activeRoute.nodeIds.length < 2) {
      if (originId && nodesMap[originId]) {
        const n = nodesMap[originId];
        fitWorldRect(
          {
            x: n.worldX - 380,
            y: n.worldY - 380,
            width: 760,
            height: 760,
          },
          40
        );
      } else {
        handleFitFullWorld();
      }
      return;
    }

    const xs = activeRoute.nodeIds
      .map((id) => nodesMap[id]?.worldX)
      .filter((v): v is number => v !== undefined);
    const ys = activeRoute.nodeIds
      .map((id) => nodesMap[id]?.worldY)
      .filter((v): v is number => v !== undefined);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    fitWorldRect(
      {
        x: minX - 160,
        y: minY - 160,
        width: Math.max(420, maxX - minX + 320),
        height: Math.max(360, maxY - minY + 320),
      },
      48
    );
  };

  const handleZoomBy = (factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const centerX = cw / 2;
    const centerY = ch / 2;

    setTransform((prev) => {
      const nextScale = Math.min(Math.max(prev.scale * factor, 0.2), 3.2);
      const scaleRatio = nextScale / prev.scale;
      const nextX = centerX - (centerX - prev.x) * scaleRatio;
      const nextY = centerY - (centerY - prev.y) * scaleRatio;
      return { x: nextX, y: nextY, scale: nextScale };
    });
  };

  // Wheel zoom centered at mouse cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.14 : 1 / 1.14;

      setTransform((prev) => {
        const nextScale = Math.min(Math.max(prev.scale * zoomFactor, 0.2), 3.2);
        const scaleRatio = nextScale / prev.scale;
        const nextX = mouseX - (mouseX - prev.x) * scaleRatio;
        const nextY = mouseY - (mouseY - prev.y) * scaleRatio;
        return { x: nextX, y: nextY, scale: nextScale };
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: transform.x,
      startY: transform.y,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (calibrationMode && draggingNodeId && onUpdateNodePosition) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - transform.x) / transform.scale;
      const worldY = (e.clientY - rect.top - transform.y) / transform.scale;
      const node = nodesMap[draggingNodeId];
      if (!node) return;

      const regionRect =
        node.region === 'elmore' ? WORLD_GEOMETRY.elmore : WORLD_GEOMETRY.aden;
      const localPctX = Math.max(
        1,
        Math.min(
          99,
          Math.round(((worldX - regionRect.x) / regionRect.width) * 1000) / 10
        )
      );
      const localPctY = Math.max(
        1,
        Math.min(
          99,
          Math.round(((worldY - regionRect.y) / regionRect.height) * 1000) / 10
        )
      );
      onUpdateNodePosition(draggingNodeId, localPctX, localPctY);
      return;
    }

    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragStartRef.current.moved = true;
    }
    setTransform((prev) => ({
      ...prev,
      x: dragStartRef.current.startX + dx,
      y: dragStartRef.current.startY + dy,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingNodeId(null);
  };

  // Visual background network lines
  const visualLines = useMemo(
    () => getVisualTeleportLines(includeCustodians),
    [includeCustodians]
  );

  // Active route edge lookup
  const activeRouteEdgePairs = useMemo(() => {
    const map = new Map<string, { hopIndex: number; cost: number; isOneWay: boolean }>();
    if (!activeRoute) return map;
    activeRoute.hops.forEach((hop, idx) => {
      map.set(`${hop.fromId}__${hop.toId}`, {
        hopIndex: idx + 1,
        cost: hop.cost,
        isOneWay: hop.isOneWay,
      });
    });
    return map;
  }, [activeRoute]);

  const activeRouteNodeSet = useMemo(() => {
    return new Set(activeRoute?.nodeIds || []);
  }, [activeRoute]);

  // Filter visible nodes
  const visibleNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (node.category === 'custodian_destination' && !includeCustodians) {
        return false;
      }
      if (node.category === 'landmark' && !showLandmarks) {
        return false;
      }
      return true;
    });
  }, [nodes, includeCustodians, showLandmarks]);

  // Handle clicking a node on the map
  const handleNodeClick = (e: React.MouseEvent, node: TeleportNode) => {
    e.stopPropagation();
    if (dragStartRef.current.moved) return;
    if (calibrationMode) return;

    const isAllowedOrigin = node.category === 'gatekeeper';

    // Right click or Shift-click always sets Origin if allowed
    if (e.shiftKey && isAllowedOrigin) {
      onSelectOrigin(node.id);
      return;
    }

    // If no origin is selected yet:
    if (!originId) {
      if (isAllowedOrigin) {
        onSelectOrigin(node.id);
      }
      return;
    }

    // If user clicked the current origin again:
    if (node.id === originId) {
      if (destinationId) {
        // Clear destination first so all destinations from this origin are shown again
        onSelectDestination(null);
      } else {
        onSelectOrigin(node.id);
      }
      return;
    }

    // If clickTargetMode is explicitly 'origin' and node is a gatekeeper:
    if (clickTargetMode === 'origin' && isAllowedOrigin) {
      onSelectOrigin(node.id);
      return;
    }

    // Otherwise, select as destination!
    if (node.id === destinationId) {
      onSelectDestination(null);
    } else {
      onSelectDestination(node.id);
    }
  };

  // Inverse scale factor so pins and price labels stay crisp and legible at any zoom level
  const pinInvScale = Math.min(Math.max(1 / Math.pow(transform.scale, 0.65), 0.65), 1.9);

  return (
    <div className="relative w-full h-full bg-[#0a0c10] overflow-hidden select-none flex flex-col">
      {/* Top Map Controls Bar */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#12151c]/95 border-b border-[#252a36] text-xs">
        {/* Left: Click Mode & Quick Region Jumps */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center bg-[#0b0d12] p-0.5 rounded-md border border-[#252a36]"
            role="group"
            aria-label="Map click mode"
          >
            <button
              type="button"
              onClick={() => onChangeClickTargetMode('origin')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                clickTargetMode === 'origin' || !originId
                  ? 'bg-[#d4a853] text-[#0e1015] font-semibold'
                  : 'text-[#a09a8e] hover:text-[#ebe6dc]'
              }`}
            >
              1. Pick Origin {originId && nodesMap[originId] ? `(${nodesMap[originId].name})` : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                if (originId) onChangeClickTargetMode('destination');
              }}
              disabled={!originId}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                originId && clickTargetMode === 'destination'
                  ? 'bg-[#38bdf8] text-[#0e1015] font-semibold'
                  : originId
                  ? 'text-[#a09a8e] hover:text-[#ebe6dc]'
                  : 'text-[#525866] cursor-not-allowed'
              }`}
            >
              2. Pick Destination {destinationId && nodesMap[destinationId] ? `(${nodesMap[destinationId].name})` : '(All Highlighted)'}
            </button>
          </div>

          <div className="h-4 w-px bg-[#252a36] hidden sm:block" />

          {/* Camera region presets */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleFitFullWorld}
              className="px-2.5 py-1 rounded bg-[#181c26] hover:bg-[#232938] text-[#d6d1c7] border border-[#262c3a] transition-colors whitespace-nowrap shrink-0"
              title="Fit both Aden and Elmore Kingdoms"
            >
              Full World
            </button>
            <button
              type="button"
              onClick={handleFitAden}
              className="px-2.5 py-1 rounded bg-[#181c26] hover:bg-[#232938] text-[#d6d1c7] border border-[#262c3a] transition-colors whitespace-nowrap shrink-0"
              title="Zoom to Aden Kingdom map"
            >
              Aden Map
            </button>
            <button
              type="button"
              onClick={handleFitElmore}
              className="px-2.5 py-1 rounded bg-[#181c26] hover:bg-[#232938] text-[#d6d1c7] border border-[#262c3a] transition-colors whitespace-nowrap shrink-0"
              title="Zoom to Elmore Kingdom map"
            >
              Elmore Map
            </button>
            {(originId || activeRoute) && (
              <button
                type="button"
                onClick={handleFitActiveRoute}
                className="px-2.5 py-1 rounded bg-[#1e2636] hover:bg-[#283348] text-[#f3c979] border border-[#d4a853]/40 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Focus Route
              </button>
            )}
          </div>
        </div>

        {/* Right: Map Layer Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          {originId && (
            <button
              type="button"
              onClick={onToggleDirectOnlyOnMap}
              className={`px-2.5 py-1 rounded border text-xs transition-colors whitespace-nowrap shrink-0 ${
                showDirectOnlyOnMap
                  ? 'bg-[#d4a853]/15 border-[#d4a853]/60 text-[#f5dfa0]'
                  : 'bg-[#181c26] border-[#262c3a] text-[#a09a8e] hover:text-[#ebe6dc]'
              }`}
              title="Toggle between showing only direct 1-hop destinations vs all reachable multi-hop destinations on the map"
            >
              {showDirectOnlyOnMap ? 'Showing: Direct (1-Hop) Only' : 'Showing: All Reachable Costs'}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCustodians}
            className={`px-2.5 py-1 rounded border text-xs transition-colors whitespace-nowrap shrink-0 ${
              includeCustodians
                ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                : 'bg-[#181c26] border-[#262c3a] text-[#a09a8e] hover:text-[#ebe6dc]'
            }`}
            title="Include 500 Adena Clan Hall Custodian teleports from Gludin, Gludio, and Dion (from 178.webp)"
          >
            Custodians (500a): {includeCustodians ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            onClick={onToggleLandmarks}
            className={`px-2.5 py-1 rounded border text-xs transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
              showLandmarks
                ? 'bg-sky-500/15 border-sky-500/60 text-sky-300'
                : 'bg-[#181c26] border-[#262c3a] text-[#a09a8e] hover:text-[#ebe6dc]'
            }`}
            title="Show all dungeons, castles, and hunting grounds on the map"
          >
            <MapPin className="w-3 h-3" />
            Landmarks
          </button>

          <button
            type="button"
            onClick={onToggleNetworkLines}
            className={`px-2.5 py-1 rounded border text-xs transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
              showAllNetworkLines
                ? 'bg-[#232938] border-[#3b445c] text-[#ebe6dc]'
                : 'bg-[#181c26] border-[#262c3a] text-[#a09a8e] hover:text-[#ebe6dc]'
            }`}
            title="Show or hide the full teleport web lines"
          >
            <Layers className="w-3 h-3" />
            Lines
          </button>

          <button
            type="button"
            onClick={onToggleGridOverlay}
            className={`px-2.5 py-1 rounded border text-xs transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
              showGridOverlay
                ? 'bg-[#232938] border-[#3b445c] text-[#ebe6dc]'
                : 'bg-[#181c26] border-[#262c3a] text-[#a09a8e] hover:text-[#ebe6dc]'
            }`}
            title="Show 179.webp Prima Guide coordinate grid"
          >
            <Grid className="w-3 h-3" />
            Grid
          </button>
        </div>
      </div>

      {/* Main Interactive Zoom/Pan Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative flex-1 overflow-hidden bg-[#0b0d12] ${
          calibrationMode
            ? 'cursor-crosshair'
            : isDragging
            ? 'cursor-grabbing'
            : 'cursor-grab'
        }`}
      >
        {/* Subtle parchment-toned radial ambient backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, #2a241b 0%, #0b0d12 75%)',
          }}
        />

        {/* Transformed World Layer */}
        <div
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: `${WORLD_GEOMETRY.width}px`,
            height: `${WORLD_GEOMETRY.height}px`,
          }}
          className="relative will-change-transform"
        >
          {/* 1. ELMORE HIGH-RES MAP (Top: 1312x984 at x=328.4, y=0) */}
          <div
            style={{
              left: `${WORLD_GEOMETRY.elmore.x}px`,
              top: `${WORLD_GEOMETRY.elmore.y}px`,
              width: `${WORLD_GEOMETRY.elmore.width}px`,
              height: `${WORLD_GEOMETRY.elmore.height}px`,
            }}
            className="absolute rounded-sm overflow-hidden shadow-2xl border-2 border-[#3c3426] bg-[#cbbca0]"
          >
            <img
              src={MAP_ASSETS.elmoreMapUrl}
              alt="Lineage II Chronicle 1 — Elmore Kingdom Map"
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() =>
                setImageLoadState((prev) => ({ ...prev, elmore: true }))
              }
              className="w-full h-full object-cover pointer-events-none select-none"
            />
            {!imageLoadState.elmore && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#26221b] text-[#c8b99e] font-display text-lg">
                Loading Elmore Kingdom Cartography...
              </div>
            )}
            {/* Region Title Watermark Plaque in Corner */}
            <div className="pointer-events-none absolute top-3 left-45 px-3 py-1 rounded bg-[#14110d]/80 border border-[#6e5d43]/60 text-[#efe4ce] font-display text-lg tracking-wider">
              KINGDOM OF ELMORE
            </div>
          </div>

          {/* 2. ADEN HIGH-RES MAP (Bottom: 1642x1476 at x=0, y=1030) */}
          <div
            style={{
              left: `${WORLD_GEOMETRY.aden.x}px`,
              top: `${WORLD_GEOMETRY.aden.y}px`,
              width: `${WORLD_GEOMETRY.aden.width}px`,
              height: `${WORLD_GEOMETRY.aden.height}px`,
            }}
            className="absolute rounded-sm overflow-hidden shadow-2xl border-2 border-[#3c3426] bg-[#cbbca0]"
          >
            <img
              src={MAP_ASSETS.adenMapUrl}
              alt="Lineage II Chronicle 1 — Aden Kingdom Map"
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() =>
                setImageLoadState((prev) => ({ ...prev, aden: true }))
              }
              className="w-full h-full object-cover pointer-events-none select-none"
            />
            {!imageLoadState.aden && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#26221b] text-[#c8b99e] font-display text-lg">
                Loading Aden Kingdom Cartography...
              </div>
            )}
            <div className="pointer-events-none absolute top-3 left-50 px-3 py-1 rounded bg-[#14110d]/80 border border-[#6e5d43]/60 text-[#efe4ce] font-display text-lg tracking-wider">
              KINGDOM OF ADEN
            </div>
          </div>

          {/* 3. OPTIONAL PRIMA GUIDE COORDINATE GRID OVERLAY (matching 179.webp) */}
          {showGridOverlay && (
            <svg
              width={WORLD_GEOMETRY.width}
              height={WORLD_GEOMETRY.height}
              viewBox={`0 0 ${WORLD_GEOMETRY.width} ${WORLD_GEOMETRY.height}`}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Elmore 8x6 Grid */}
              {Array.from({ length: WORLD_GEOMETRY.elmore.cols + 1 }).map(
                (_, i) => {
                  const gx =
                    WORLD_GEOMETRY.elmore.x +
                    (i * WORLD_GEOMETRY.elmore.width) /
                      WORLD_GEOMETRY.elmore.cols;
                  return (
                    <g key={`elmore-col-${i}`}>
                      <line
                        x1={gx}
                        y1={WORLD_GEOMETRY.elmore.y}
                        x2={gx}
                        y2={
                          WORLD_GEOMETRY.elmore.y + WORLD_GEOMETRY.elmore.height
                        }
                        stroke="rgba(20, 16, 10, 0.55)"
                        strokeWidth={1.5}
                      />
                      {i < WORLD_GEOMETRY.elmore.cols && (
                        <text
                          x={gx + 12}
                          y={WORLD_GEOMETRY.elmore.y + 24}
                          fill="rgba(20, 16, 10, 0.75)"
                          fontSize="16"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {String.fromCharCode(65 + i)}
                        </text>
                      )}
                    </g>
                  );
                }
              )}
              {Array.from({ length: WORLD_GEOMETRY.elmore.rows + 1 }).map(
                (_, j) => {
                  const gy =
                    WORLD_GEOMETRY.elmore.y +
                    (j * WORLD_GEOMETRY.elmore.height) /
                      WORLD_GEOMETRY.elmore.rows;
                  return (
                    <g key={`elmore-row-${j}`}>
                      <line
                        x1={WORLD_GEOMETRY.elmore.x}
                        y1={gy}
                        x2={
                          WORLD_GEOMETRY.elmore.x + WORLD_GEOMETRY.elmore.width
                        }
                        y2={gy}
                        stroke="rgba(20, 16, 10, 0.55)"
                        strokeWidth={1.5}
                      />
                      {j < WORLD_GEOMETRY.elmore.rows && (
                        <text
                          x={WORLD_GEOMETRY.elmore.x + 10}
                          y={gy + 26}
                          fill="rgba(20, 16, 10, 0.75)"
                          fontSize="16"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {j + 1}
                        </text>
                      )}
                    </g>
                  );
                }
              )}

              {/* Aden 10x9 Grid */}
              {Array.from({ length: WORLD_GEOMETRY.aden.cols + 1 }).map(
                (_, i) => {
                  const gx =
                    WORLD_GEOMETRY.aden.x +
                    (i * WORLD_GEOMETRY.aden.width) / WORLD_GEOMETRY.aden.cols;
                  return (
                    <g key={`aden-col-${i}`}>
                      <line
                        x1={gx}
                        y1={WORLD_GEOMETRY.aden.y}
                        x2={gx}
                        y2={WORLD_GEOMETRY.aden.y + WORLD_GEOMETRY.aden.height}
                        stroke="rgba(20, 16, 10, 0.55)"
                        strokeWidth={1.5}
                      />
                      {i < WORLD_GEOMETRY.aden.cols && (
                        <text
                          x={gx + 12}
                          y={WORLD_GEOMETRY.aden.y + 24}
                          fill="rgba(20, 16, 10, 0.75)"
                          fontSize="16"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {String.fromCharCode(65 + i)}
                        </text>
                      )}
                    </g>
                  );
                }
              )}
              {Array.from({ length: WORLD_GEOMETRY.aden.rows + 1 }).map(
                (_, j) => {
                  const gy =
                    WORLD_GEOMETRY.aden.y +
                    (j * WORLD_GEOMETRY.aden.height) / WORLD_GEOMETRY.aden.rows;
                  return (
                    <g key={`aden-row-${j}`}>
                      <line
                        x1={WORLD_GEOMETRY.aden.x}
                        y1={gy}
                        x2={WORLD_GEOMETRY.aden.x + WORLD_GEOMETRY.aden.width}
                        y2={gy}
                        stroke="rgba(20, 16, 10, 0.55)"
                        strokeWidth={1.5}
                      />
                      {j < WORLD_GEOMETRY.aden.rows && (
                        <text
                          x={WORLD_GEOMETRY.aden.x + 10}
                          y={gy + 26}
                          fill="rgba(20, 16, 10, 0.75)"
                          fontSize="16"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {j + 1}
                        </text>
                      )}
                    </g>
                  );
                }
              )}
            </svg>
          )}

          {/* 4. TELEPORT NETWORK SVG OVERLAY (2-way solid lines, 1-way dotted lines, and active route arrows) */}
          <svg
            width={WORLD_GEOMETRY.width}
            height={WORLD_GEOMETRY.height}
            viewBox={`0 0 ${WORLD_GEOMETRY.width} ${WORLD_GEOMETRY.height}`}
            className="absolute inset-0 pointer-events-none"
          >
            <defs>
              {/* Standard Network Arrowheads (matching 179.webp black/dark arrowheads) */}
              <marker
                id="arrow-net-end"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#181510" />
              </marker>
              <marker
                id="arrow-net-start"
                viewBox="0 0 10 10"
                refX="2"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto"
              >
                <path d="M 10 1.5 L 1 5 L 10 8.5 z" fill="#181510" />
              </marker>

              {/* Direct Outgoing Highlight Arrowheads */}
              <marker
                id="arrow-direct-end"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#d4a853" />
              </marker>
              <marker
                id="arrow-direct-start"
                viewBox="0 0 10 10"
                refX="2"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 10 1.5 L 1 5 L 10 8.5 z" fill="#d4a853" />
              </marker>

              {/* Active Route Illuminated Arrowhead */}
              <marker
                id="arrow-active-end"
                viewBox="0 0 10 10"
                refX="7.5"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
              </marker>
            </defs>

            {/* Layer 4A: Base Teleport Network Lines (matching 179.webp solid 2-way and dotted 1-way) */}
            {showAllNetworkLines &&
              visualLines.map((line) => {
                const fromNode = nodesMap[line.from];
                const toNode = nodesMap[line.to];
                if (!fromNode || !toNode) return null;

                // Shorten endpoints slightly so arrowheads sit right at node rings
                const dx = toNode.worldX - fromNode.worldX;
                const dy = toNode.worldY - fromNode.worldY;
                const dist = Math.hypot(dx, dy);
                if (dist < 1) return null;
                const pad = 18;
                const x1 = fromNode.worldX + (dx / dist) * pad;
                const y1 = fromNode.worldY + (dy / dist) * pad;
                const x2 = toNode.worldX - (dx / dist) * pad;
                const y2 = toNode.worldY - (dy / dist) * pad;

                const isDirectFromOrigin =
                  originId &&
                  (line.from === originId ||
                    (line.isTwoWay && line.to === originId));

                const isDimmed = Boolean(originId && !isDirectFromOrigin);

                return (
                  <g key={line.id} opacity={isDimmed ? 0.32 : 0.82}>
                    {/* Outer parchment halo for legibility over dark terrain */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="rgba(235, 224, 198, 0.55)"
                      strokeWidth={isDirectFromOrigin ? 6 : 4.5}
                      strokeLinecap="round"
                    />
                    {/* Core solid (2-way) or dotted (1-way) line per 179.webp */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={
                        line.isCustodian
                          ? '#059669'
                          : isDirectFromOrigin
                          ? '#d4a853'
                          : '#181510'
                      }
                      strokeWidth={isDirectFromOrigin ? 3.2 : 2.4}
                      strokeDasharray={line.isTwoWay ? undefined : '5 6'}
                      markerStart={
                        line.isTwoWay
                          ? isDirectFromOrigin
                            ? 'url(#arrow-direct-start)'
                            : 'url(#arrow-net-start)'
                          : undefined
                      }
                      markerEnd={
                        isDirectFromOrigin
                          ? 'url(#arrow-direct-end)'
                          : 'url(#arrow-net-end)'
                      }
                    />
                  </g>
                );
              })}

            {/* Layer 4B: Active Computed Route Path & Step Cost Callouts */}
            {activeRoute &&
              activeRoute.hops.map((hop, idx) => {
                const fromNode = nodesMap[hop.fromId];
                const toNode = nodesMap[hop.toId];
                if (!fromNode || !toNode) return null;

                const dx = toNode.worldX - fromNode.worldX;
                const dy = toNode.worldY - fromNode.worldY;
                const dist = Math.hypot(dx, dy);
                if (dist < 1) return null;

                const pad = 22;
                const x1 = fromNode.worldX + (dx / dist) * pad;
                const y1 = fromNode.worldY + (dy / dist) * pad;
                const x2 = toNode.worldX - (dx / dist) * pad;
                const y2 = toNode.worldY - (dy / dist) * pad;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                return (
                  <g key={`active-hop-${hop.edgeId}-${idx}`}>
                    {/* Dark contrast casing */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#090c12"
                      strokeWidth={8.5}
                      strokeLinecap="round"
                    />
                    {/* Glowing active path line (solid for 2-way, dashed for 1-way) */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#38bdf8"
                      strokeWidth={4.2}
                      strokeDasharray={hop.isOneWay ? '8 6' : undefined}
                      markerEnd="url(#arrow-active-end)"
                      strokeLinecap="round"
                    />

                    {/* Midpoint Hop Price Label */}
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-48}
                        y={-13}
                        width={96}
                        height={26}
                        rx={5}
                        fill="#0e121a"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fill="#f0f9ff"
                        fontSize="12"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        #{idx + 1}: {hop.cost.toLocaleString()}a
                      </text>
                    </g>
                  </g>
                );
              })}
          </svg>

          {/* 5. INTERACTIVE LOCATION PINS & ADENA ROUTE PRICE TAGS */}
          {visibleNodes.map((node) => {
            const isOrigin = node.id === originId;
            const isDestination = node.id === destinationId;
            const isHovered = node.id === hoveredNodeId;
            const isInActiveRoute = activeRouteNodeSet.has(node.id);

            const reachability = originId
              ? reachabilityMap.get(node.id)
              : undefined;

            const isDirectReachable =
              reachability && reachability.directCost !== null;
            const isReachable = Boolean(reachability);

            // When showDirectOnlyOnMap is active, hide price tags on multi-hop nodes unless part of active route
            const shouldShowPriceBadge =
              originId &&
              !isOrigin &&
              reachability &&
              (!showDirectOnlyOnMap || isDirectReachable || isDestination || isInActiveRoute);

            const isGatekeeper = node.category === 'gatekeeper';
            const isOneWayNode = node.category === 'one_way_destination';
            const isCustodianNode = node.category === 'custodian_destination';
            const isLandmark = node.category === 'landmark';

            // Dim nodes that are unreachable when an origin is selected
            const isDimmed =
              originId &&
              !isOrigin &&
              !isReachable &&
              !isLandmark &&
              !isInActiveRoute;

            // Determine z-index so selected/hovered pins always sit above neighbors
            const zIndex = isOrigin || isDestination
              ? 40
              : isHovered || isInActiveRoute
              ? 35
              : isDirectReachable
              ? 25
              : isGatekeeper
              ? 20
              : 10;

            return (
              <div
                key={node.id}
                style={{
                  left: `${node.worldX}px`,
                  top: `${node.worldY}px`,
                  zIndex,
                  transform: `translate(-50%, -50%) scale(${pinInvScale})`,
                }}
                onMouseDown={(e) => {
                  if (calibrationMode) {
                    e.stopPropagation();
                    setDraggingNodeId(node.id);
                  }
                }}
                onClick={(e) => handleNodeClick(e, node)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isGatekeeper) {
                    onSelectOrigin(node.id);
                  }
                }}
                onMouseEnter={() => onHoverNode(node.id)}
                onMouseLeave={() => onHoverNode(null)}
                className={`absolute group cursor-pointer transition-opacity duration-150 ${
                  isDimmed ? 'opacity-35 hover:opacity-90' : 'opacity-100'
                }`}
              >
                {/* Pin Marker Circle */}
                <div
                  className={`relative flex items-center justify-center rounded-full transition-transform duration-150 ${
                    isOrigin
                      ? 'w-8 h-8 bg-[#d4a853] text-[#0b0d12] ring-4 ring-[#d4a853]/40 shadow-lg scale-110'
                      : isDestination
                      ? 'w-8 h-8 bg-[#38bdf8] text-[#0b0d12] ring-4 ring-[#38bdf8]/40 shadow-lg scale-110'
                      : isInActiveRoute
                      ? 'w-7 h-7 bg-[#1e293b] text-[#38bdf8] border-2 border-[#38bdf8] shadow-md'
                      : isDirectReachable
                      ? 'w-7 h-7 bg-[#171b24] text-[#f5dfa0] border-2 border-[#d4a853] shadow-md group-hover:scale-110'
                      : isGatekeeper
                      ? 'w-6 h-6 bg-[#141820] text-[#ebe6dc] border-2 border-[#948b78] shadow-md group-hover:scale-110 group-hover:border-[#d4a853]'
                      : isOneWayNode
                      ? 'w-5 h-5 bg-[#231917] text-[#fca5a5] border-2 border-dashed border-[#f87171] shadow group-hover:scale-110'
                      : isCustodianNode
                      ? 'w-5 h-5 bg-[#10261e] text-[#6ee7b7] border border-emerald-400 shadow group-hover:scale-110'
                      : 'w-4 h-4 bg-[#1c1917]/90 text-[#d6d3d1] border border-[#78716c] group-hover:scale-125'
                  }`}
                >
                  {isGatekeeper ? (
                    <span className="font-display font-bold text-[11px] leading-none">
                      T
                    </span>
                  ) : isOneWayNode ? (
                    <span className="font-mono font-bold text-[9px] leading-none">
                      1W
                    </span>
                  ) : isCustodianNode ? (
                    <span className="font-mono font-bold text-[9px] leading-none">
                      C
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#a8a29e]" />
                  )}
                </div>

                {/* Location Name + Adena Cost Callout Tag */}
                <div
                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 flex flex-col items-center whitespace-nowrap transition-all duration-150 ${
                    isLandmark && !isHovered && !isDestination
                      ? 'opacity-80 scale-90'
                      : 'opacity-100'
                  }`}
                >
                  {/* Town / Node Label */}
                  <div
                    className={`px-2 py-0.5 rounded text-[11px] font-medium tracking-tight shadow-md border ${
                      isOrigin
                        ? 'bg-[#d4a853] text-[#0b0d12] border-[#f5dfa0] font-bold'
                        : isDestination
                        ? 'bg-[#38bdf8] text-[#0b0d12] border-[#bae6fd] font-bold'
                        : isInActiveRoute
                        ? 'bg-[#0f172a]/95 text-[#bae6fd] border-[#38bdf8]/70 font-semibold'
                        : isGatekeeper
                        ? 'bg-[#10131a]/92 text-[#f3efe6] border-[#383e4e]'
                        : isOneWayNode
                        ? 'bg-[#1f1414]/92 text-[#fecaca] border-[#7f1d1d]'
                        : isCustodianNode
                        ? 'bg-[#0d1f18]/92 text-[#a7f3d0] border-[#065f46]'
                        : 'bg-[#141210]/85 text-[#d6d3d1] border-[#292524] text-[10px]'
                    }`}
                  >
                    <span>{node.name}</span>
                    {isOrigin && (
                      <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider opacity-85">
                        · ORIGIN
                      </span>
                    )}
                  </div>

                  {/* Exact Adena Price Tag when an Origin is selected */}
                  {shouldShowPriceBadge && reachability && (
                    <div
                      className={`mt-0.5 px-2 py-0.5 rounded font-mono text-[11px] font-semibold tabular-nums shadow-lg border flex items-center gap-1 ${
                        isDestination
                          ? 'bg-[#082f49] text-[#7dd3fc] border-[#38bdf8]'
                          : isDirectReachable
                          ? 'bg-[#1c160b]/95 text-[#f5dfa0] border-[#d4a853]'
                          : 'bg-[#131722]/95 text-[#cbd5e1] border-[#475569]'
                      }`}
                    >
                      <span>{formatAdena(reachability.minCost)}</span>
                      <span className="opacity-60">·</span>
                      <span className="text-[10px] font-normal opacity-90">
                        {reachability.hopCount === 1
                          ? 'Direct'
                          : `${reachability.hopCount} hops`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Zoom & Legend Overlay (Bottom-Left & Bottom-Right) */}
        <div className="z-20 pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between gap-4">
          {/* Map Legend (matches 179.webp & 178.webp notation) */}
          <div className="pointer-events-auto bg-[#12151c]/95 border border-[#252a36] rounded-lg px-3.5 py-2.5 text-xs text-[#c7c2b8] shadow-xl max-w-md">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#141820] border border-[#d4a853] font-display font-bold text-[9px] text-[#f5dfa0]">
                  T
                </span>
                <span>Gatekeeper Town (15)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#231917] border border-dashed border-[#f87171] font-mono font-bold text-[8px] text-[#fca5a5]">
                  1W
                </span>
                <span>1-Way Hunting Drop-off</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-0.5 bg-[#ebe6dc] inline-block" />
                <span>2-Way Teleport</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-0.5 border-b-2 border-dotted border-[#ebe6dc] inline-block" />
                <span>1-Way Teleport</span>
              </div>
            </div>
            <div className="mt-1.5 text-[11px] text-[#8c867a]">
              Tip: Click any <strong className="text-[#ebe6dc]">T</strong> town to highlight all destinations with Adena prices. Right-click or Shift-click any town to set it as Origin directly.
            </div>
          </div>

          {/* Floating Zoom Controls */}
          <div className="pointer-events-auto flex flex-col gap-1 bg-[#12151c]/95 border border-[#252a36] rounded-lg p-1 shadow-xl">
            <button
              type="button"
              onClick={() => handleZoomBy(1.25)}
              className="p-2 rounded hover:bg-[#1e2430] text-[#ebe6dc] transition-colors"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="text-center font-mono text-[10px] text-[#8c867a] py-0.5 tabular-nums">
              {Math.round(transform.scale * 100)}%
            </div>
            <button
              type="button"
              onClick={() => handleZoomBy(1 / 1.25)}
              className="p-2 rounded hover:bg-[#1e2430] text-[#ebe6dc] transition-colors"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="h-px bg-[#252a36] my-0.5" />
            <button
              type="button"
              onClick={handleFitFullWorld}
              className="p-2 rounded hover:bg-[#1e2430] text-[#ebe6dc] transition-colors"
              title="Reset view to full world"
              aria-label="Reset view"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
