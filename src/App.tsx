/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  DIRECTED_TELEPORT_ROUTES,
  TELEPORT_NODES,
  TeleportNode,
  computeWorldCoords,
} from './data/lineage2MapData';
import {
  ComputedRoute,
  computeAllDestinationsFromOrigin,
  findNearestTeleportNode,
  findTopRoutesBetween,
} from './utils/pathfinding';
import { InteractiveWorldMap } from './components/InteractiveWorldMap';
import { RoutePlannerSidebar } from './components/RoutePlannerSidebar';
import { SecondaryViews } from './components/SecondaryViews';

type ActiveViewTab = 'map' | 'matrix' | 'directory' | 'notes';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('map');
  const [nodes, setNodes] = useState<TeleportNode[]>(TELEPORT_NODES);

  // Start with Gludin Village selected so all reachable destination costs are immediately visible,
  // while allowing 1-click Reset or clicking any Origin/Destination on the map.
  const [originId, setOriginId] = useState<string | null>('gludin');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  // Map display toggles
  const [includeCustodians, setIncludeCustodians] = useState<boolean>(false);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(false);
  const [showAllNetworkLines, setShowAllNetworkLines] = useState<boolean>(true);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [showDirectOnlyOnMap, setShowDirectOnlyOnMap] = useState<boolean>(false);
  const [calibrationMode, setCalibrationMode] = useState<boolean>(false);
  const [clickTargetMode, setClickTargetMode] = useState<'origin' | 'destination'>(
    'destination'
  );

  const nodesMap = useMemo(() => {
    return Object.fromEntries(nodes.map((n) => [n.id, n]));
  }, [nodes]);

  // Compute reachability & exact Adena cost to all possible destinations from selected Origin
  const reachabilityMap = useMemo(() => {
    if (!originId) return new Map();
    return computeAllDestinationsFromOrigin(
      originId,
      includeCustodians,
      nodesMap
    );
  }, [originId, includeCustodians, nodesMap]);

  // Determine effective destination (either locked destinationId, or hoveredNodeId when previewing from an origin)
  const previewOrLockedDestId = destinationId || hoveredNodeId;

  const effectiveDestNodeId = useMemo(() => {
    if (!previewOrLockedDestId || previewOrLockedDestId === originId) {
      return null;
    }
    const targetNode = nodesMap[previewOrLockedDestId];
    if (!targetNode) return null;
    if (targetNode.category === 'landmark') {
      const nearest = findNearestTeleportNode(
        targetNode,
        includeCustodians,
        nodesMap
      );
      return nearest?.nearestNode.id || null;
    }
    return targetNode.id;
  }, [previewOrLockedDestId, originId, includeCustodians, nodesMap]);

  // Active route to draw on the map (either for locked destination + selectedRouteIndex, or hovered preview)
  const activeRoute: ComputedRoute | null = useMemo(() => {
    if (!originId || !effectiveDestNodeId || originId === effectiveDestNodeId) {
      return null;
    }
    const routes = findTopRoutesBetween(
      originId,
      effectiveDestNodeId,
      includeCustodians,
      6,
      nodesMap
    );
    if (routes.length === 0) return null;
    if (destinationId) {
      return (
        routes[Math.min(selectedRouteIndex, Math.max(0, routes.length - 1))] ||
        routes[0]
      );
    }
    return routes[0];
  }, [
    originId,
    effectiveDestNodeId,
    destinationId,
    selectedRouteIndex,
    includeCustodians,
    nodesMap,
  ]);

  const handleSelectOrigin = useCallback((nodeId: string) => {
    setOriginId(nodeId);
    setDestinationId((prevDest) => (prevDest === nodeId ? null : prevDest));
    setSelectedRouteIndex(0);
    setClickTargetMode('destination');
  }, []);

  const handleSelectDestination = useCallback((nodeId: string | null) => {
    setDestinationId(nodeId);
    setSelectedRouteIndex(0);
    if (nodeId) {
      setClickTargetMode('destination');
    }
  }, []);

  const handleSwapOriginDestination = useCallback(() => {
    if (!originId || !destinationId) return;
    const destNode = nodesMap[destinationId];
    if (!destNode || destNode.category !== 'gatekeeper') return;
    setOriginId(destinationId);
    setDestinationId(originId);
    setSelectedRouteIndex(0);
  }, [originId, destinationId, nodesMap]);

  const handleResetAll = useCallback(() => {
    setOriginId(null);
    setDestinationId(null);
    setSelectedRouteIndex(0);
    setClickTargetMode('origin');
  }, []);

  const handleUpdateNodePosition = useCallback(
    (nodeId: string, localPctX: number, localPctY: number) => {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== nodeId) return node;
          const { worldX, worldY, gridRef } = computeWorldCoords(
            node.region,
            localPctX,
            localPctY
          );
          return {
            ...node,
            localPctX,
            localPctY,
            worldX,
            worldY,
            gridRef,
          };
        })
      );
    },
    []
  );

  const handleDownloadJson = () => {
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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0e1015] text-[#ebe6dc]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3 bg-[#12151c] border-b border-[#252a36] shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#map"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('map');
          }}
          className="font-display text-base font-bold tracking-wider text-[#f3efe6] hover:text-[#d4a853] transition-colors whitespace-nowrap shrink-0"
        >
          LINEAGE II: CHRONICLE 1 ATLAS
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-xs sm:text-sm font-medium text-[#a8a296] overflow-x-auto">
          <a
            href="#map"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('map');
            }}
            className={`hover:text-[#f3efe6] transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeTab === 'map'
                ? 'text-[#f5dfa0] underline underline-offset-4 decoration-[#d4a853]'
                : ''
            }`}
          >
            Interactive Map
          </a>
          <a
            href="#matrix"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('matrix');
            }}
            className={`hover:text-[#f3efe6] transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeTab === 'matrix'
                ? 'text-[#f5dfa0] underline underline-offset-4 decoration-[#d4a853]'
                : ''
            }`}
          >
            Route Matrix
          </a>
          <a
            href="#directory"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('directory');
            }}
            className={`hover:text-[#f3efe6] transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeTab === 'directory'
                ? 'text-[#f5dfa0] underline underline-offset-4 decoration-[#d4a853]'
                : ''
            }`}
          >
            Gatekeeper Directory
          </a>
          <a
            href="#notes"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('notes');
            }}
            className={`hover:text-[#f3efe6] transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeTab === 'notes'
                ? 'text-[#f5dfa0] underline underline-offset-4 decoration-[#d4a853]'
                : ''
            }`}
          >
            Data Notes
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleDownloadJson}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#0e1015] bg-[#d4a853] hover:bg-[#e2b968] rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Export Route JSON
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      {activeTab === 'map' ? (
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 h-[58vh] lg:h-full relative overflow-hidden">
            <InteractiveWorldMap
              nodes={nodes}
              nodesMap={nodesMap}
              originId={originId}
              destinationId={destinationId}
              hoveredNodeId={hoveredNodeId}
              activeRoute={activeRoute}
              reachabilityMap={reachabilityMap}
              includeCustodians={includeCustodians}
              showLandmarks={showLandmarks}
              showAllNetworkLines={showAllNetworkLines}
              showGridOverlay={showGridOverlay}
              showDirectOnlyOnMap={showDirectOnlyOnMap}
              calibrationMode={calibrationMode}
              clickTargetMode={clickTargetMode}
              onSelectOrigin={handleSelectOrigin}
              onSelectDestination={handleSelectDestination}
              onHoverNode={setHoveredNodeId}
              onChangeClickTargetMode={setClickTargetMode}
              onToggleCustodians={() =>
                setIncludeCustodians((prev) => !prev)
              }
              onToggleLandmarks={() => setShowLandmarks((prev) => !prev)}
              onToggleNetworkLines={() =>
                setShowAllNetworkLines((prev) => !prev)
              }
              onToggleGridOverlay={() => setShowGridOverlay((prev) => !prev)}
              onToggleDirectOnlyOnMap={() =>
                setShowDirectOnlyOnMap((prev) => !prev)
              }
              onUpdateNodePosition={handleUpdateNodePosition}
            />
          </div>

          <RoutePlannerSidebar
            nodes={nodes}
            nodesMap={nodesMap}
            originId={originId}
            destinationId={destinationId}
            selectedRouteIndex={selectedRouteIndex}
            includeCustodians={includeCustodians}
            reachabilityMap={reachabilityMap}
            onSelectOrigin={handleSelectOrigin}
            onSelectDestination={handleSelectDestination}
            onSelectRouteIndex={setSelectedRouteIndex}
            onHoverNode={setHoveredNodeId}
            onSwapOriginDestination={handleSwapOriginDestination}
            onResetAll={handleResetAll}
          />
        </main>
      ) : (
        <SecondaryViews
          activeTab={activeTab}
          nodes={nodes}
          nodesMap={nodesMap}
          includeCustodians={includeCustodians}
          calibrationMode={calibrationMode}
          onSelectRouteAndSwitchToMap={(origId, destId) => {
            setOriginId(origId);
            setDestinationId(destId);
            setSelectedRouteIndex(0);
            setClickTargetMode('destination');
            setActiveTab('map');
          }}
          onSelectOriginAndSwitchToMap={(origId) => {
            setOriginId(origId);
            setDestinationId(null);
            setSelectedRouteIndex(0);
            setClickTargetMode('destination');
            setActiveTab('map');
          }}
          onToggleCalibrationMode={() => {
            setCalibrationMode((prev) => !prev);
            setActiveTab('map');
          }}
          onResetCoordinates={() => setNodes(TELEPORT_NODES)}
        />
      )}
    </div>
  );
}
