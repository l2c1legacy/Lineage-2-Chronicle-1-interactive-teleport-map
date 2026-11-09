import {
  DIRECTED_TELEPORT_ROUTES,
  DirectedRouteEdge,
  NODE_MAP,
  TELEPORT_NODES,
  TeleportNode,
} from '../data/lineage2MapData';

export interface RouteHop {
  edgeId: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  bookDestinationLabel: string;
  gatekeeper: string;
  cost: number;
  cumulativeCost: number;
  isOneWay: boolean;
  isCustodian: boolean;
}

export interface ComputedRoute {
  id: string;
  originId: string;
  destinationId: string;
  totalCost: number;
  hopCount: number;
  nodeIds: string[];
  hops: RouteHop[];
  hasOneWaySegment: boolean;
  hasCustodianSegment: boolean;
  isDirect: boolean;
  isCheapest: boolean;
  isFastest: boolean;
  deltaFromCheapest: number;
}

export interface DestinationReachability {
  destinationId: string;
  minCost: number;
  hopCount: number;
  bestRoute: ComputedRoute;
  /** Cost of a direct 1-hop teleport from originId -> destinationId, if one exists */
  directCost: number | null;
  /** True if direct teleport exists and is strictly more expensive than multi-hop */
  multiHopSavesAdena: boolean;
  /** Minimum Adena cost to return from destinationId -> originId (null if 1-way dead-end) */
  returnMinCost: number | null;
}

export function buildAdjacencyList(
  includeCustodians: boolean
): Map<string, DirectedRouteEdge[]> {
  const adj = new Map<string, DirectedRouteEdge[]>();
  for (const edge of DIRECTED_TELEPORT_ROUTES) {
    if (!includeCustodians && edge.isCustodian) continue;
    const list = adj.get(edge.from) || [];
    list.push(edge);
    adj.set(edge.from, list);
  }
  return adj;
}

function buildComputedRoute(
  originId: string,
  destinationId: string,
  edges: DirectedRouteEdge[],
  nodesLookup: Record<string, TeleportNode> = NODE_MAP
): ComputedRoute {
  let cumulative = 0;
  const hops: RouteHop[] = edges.map((edge) => {
    cumulative += edge.cost;
    return {
      edgeId: edge.id,
      fromId: edge.from,
      toId: edge.to,
      fromName: nodesLookup[edge.from]?.name || edge.from,
      toName: nodesLookup[edge.to]?.name || edge.to,
      bookDestinationLabel: edge.bookDestinationLabel,
      gatekeeper: edge.gatekeeper,
      cost: edge.cost,
      cumulativeCost: cumulative,
      isOneWay: edge.isOneWay,
      isCustodian: edge.isCustodian,
    };
  });

  const nodeIds = [originId, ...edges.map((e) => e.to)];

  return {
    id: nodeIds.join('->'),
    originId,
    destinationId,
    totalCost: cumulative,
    hopCount: edges.length,
    nodeIds,
    hops,
    hasOneWaySegment: edges.some((e) => e.isOneWay),
    hasCustodianSegment: edges.some((e) => e.isCustodian),
    isDirect: edges.length === 1,
    isCheapest: false,
    isFastest: false,
    deltaFromCheapest: 0,
  };
}

/**
 * Runs Dijkstra's algorithm from a single origin to find the cheapest path
 * to every reachable destination in the game world.
 */
export function computeSingleSourceShortestPaths(
  originId: string,
  includeCustodians: boolean,
  nodesLookup: Record<string, TeleportNode> = NODE_MAP
): Map<string, ComputedRoute> {
  const adj = buildAdjacencyList(includeCustodians);
  const bestCost = new Map<string, number>();
  const bestHops = new Map<string, number>();
  const bestEdges = new Map<string, DirectedRouteEdge[]>();

  interface QueueItem {
    nodeId: string;
    cost: number;
    edges: DirectedRouteEdge[];
  }

  const queue: QueueItem[] = [{ nodeId: originId, cost: 0, edges: [] }];
  bestCost.set(originId, 0);
  bestHops.set(originId, 0);

  while (queue.length > 0) {
    // Sort by lowest cost, then fewest hops
    queue.sort((a, b) => a.cost - b.cost || a.edges.length - b.edges.length);
    const current = queue.shift()!;

    const recordedCost = bestCost.get(current.nodeId);
    const recordedHops = bestHops.get(current.nodeId);
    if (
      recordedCost !== undefined &&
      (current.cost > recordedCost ||
        (current.cost === recordedCost &&
          recordedHops !== undefined &&
          current.edges.length > recordedHops))
    ) {
      continue;
    }

    const outgoing = adj.get(current.nodeId) || [];
    for (const edge of outgoing) {
      if (current.edges.some((e) => e.from === edge.to)) continue; // Avoid cycles
      const nextCost = current.cost + edge.cost;
      const nextHops = current.edges.length + 1;
      const prevBestCost = bestCost.get(edge.to);
      const prevBestHops = bestHops.get(edge.to) ?? Infinity;

      if (
        prevBestCost === undefined ||
        nextCost < prevBestCost ||
        (nextCost === prevBestCost && nextHops < prevBestHops)
      ) {
        const nextEdges = [...current.edges, edge];
        bestCost.set(edge.to, nextCost);
        bestHops.set(edge.to, nextHops);
        bestEdges.set(edge.to, nextEdges);
        queue.push({
          nodeId: edge.to,
          cost: nextCost,
          edges: nextEdges,
        });
      }
    }
  }

  const result = new Map<string, ComputedRoute>();
  for (const [destId, edges] of bestEdges.entries()) {
    if (destId === originId) continue;
    const route = buildComputedRoute(originId, destId, edges, nodesLookup);
    route.isCheapest = true;
    result.set(destId, route);
  }

  return result;
}

/**
 * Computes comprehensive reachability from a selected origin to all possible destinations,
 * including direct 1-hop price comparison and return-trip cost analysis.
 */
export function computeAllDestinationsFromOrigin(
  originId: string,
  includeCustodians: boolean,
  nodesLookup: Record<string, TeleportNode> = NODE_MAP
): Map<string, DestinationReachability> {
  const forwardRoutes = computeSingleSourceShortestPaths(
    originId,
    includeCustodians,
    nodesLookup
  );
  const adj = buildAdjacencyList(includeCustodians);
  const directEdgesFromOrigin = adj.get(originId) || [];

  const reachabilityMap = new Map<string, DestinationReachability>();

  for (const [destId, bestRoute] of forwardRoutes.entries()) {
    const directEdge = directEdgesFromOrigin.find((e) => e.to === destId);
    const directCost = directEdge ? directEdge.cost : null;

    // Check return cost from destId -> originId
    const returnPaths = computeSingleSourceShortestPaths(
      destId,
      includeCustodians,
      nodesLookup
    );
    const returnBest = returnPaths.get(originId);

    reachabilityMap.set(destId, {
      destinationId: destId,
      minCost: bestRoute.totalCost,
      hopCount: bestRoute.hopCount,
      bestRoute,
      directCost,
      multiHopSavesAdena:
        directCost !== null && bestRoute.totalCost < directCost,
      returnMinCost: returnBest ? returnBest.totalCost : null,
    });
  }

  return reachabilityMap;
}

/**
 * Finds up to `maxRoutes` cheapest simple paths between `originId` and `destinationId`,
 * ordered by total Adena cost (and tie-broken by hop count).
 */
export function findTopRoutesBetween(
  originId: string,
  destinationId: string,
  includeCustodians: boolean,
  maxRoutes: number = 6,
  nodesLookup: Record<string, TeleportNode> = NODE_MAP
): ComputedRoute[] {
  if (!originId || !destinationId || originId === destinationId) return [];

  const adj = buildAdjacencyList(includeCustodians);

  interface PathCandidate {
    currentNode: string;
    cost: number;
    visited: Set<string>;
    edges: DirectedRouteEdge[];
  }

  const queue: PathCandidate[] = [
    {
      currentNode: originId,
      cost: 0,
      visited: new Set([originId]),
      edges: [],
    },
  ];

  const foundRoutes: ComputedRoute[] = [];

  while (queue.length > 0 && foundRoutes.length < maxRoutes) {
    queue.sort((a, b) => a.cost - b.cost || a.edges.length - b.edges.length);
    const current = queue.shift()!;

    if (current.currentNode === destinationId) {
      foundRoutes.push(
        buildComputedRoute(originId, destinationId, current.edges, nodesLookup)
      );
      continue;
    }

    // Cap hop depth at 7 so we don't explore meandering 12-hop loops
    if (current.edges.length >= 7) continue;

    const outgoing = adj.get(current.currentNode) || [];
    for (const edge of outgoing) {
      if (current.visited.has(edge.to)) continue;
      const nextVisited = new Set(current.visited);
      nextVisited.add(edge.to);
      queue.push({
        currentNode: edge.to,
        cost: current.cost + edge.cost,
        visited: nextVisited,
        edges: [...current.edges, edge],
      });
    }
  }

  if (foundRoutes.length === 0) return [];

  const minCost = foundRoutes[0].totalCost;
  const minHops = Math.min(...foundRoutes.map((r) => r.hopCount));

  return foundRoutes.map((route, idx) => ({
    ...route,
    isCheapest: route.totalCost === minCost && idx === 0,
    isFastest: route.hopCount === minHops,
    deltaFromCheapest: route.totalCost - minCost,
  }));
}

/**
 * Given a non-teleport world landmark (e.g., Antharas's Nest, Tower of Insolence),
 * finds the closest teleport destination on the same continent and calculates the route.
 */
export function findNearestTeleportNode(
  landmark: TeleportNode,
  includeCustodians: boolean,
  nodesLookup: Record<string, TeleportNode> = NODE_MAP
): { nearestNode: TeleportNode; distancePx: number } | null {
  const candidates = Object.values(nodesLookup).filter(
    (n) =>
      n.region === landmark.region &&
      (n.category === 'gatekeeper' ||
        n.category === 'one_way_destination' ||
        (includeCustodians && n.category === 'custodian_destination'))
  );

  let bestNode: TeleportNode | null = null;
  let bestDist = Infinity;

  for (const cand of candidates) {
    const dx = cand.worldX - landmark.worldX;
    const dy = cand.worldY - landmark.worldY;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestNode = cand;
    }
  }

  return bestNode ? { nearestNode: bestNode, distancePx: Math.round(bestDist) } : null;
}

export function formatAdena(amount: number): string {
  if (amount === 0) return 'Free';
  return `${amount.toLocaleString('en-US')} a`;
}

export function getAllowedOrigins(
  nodes: TeleportNode[] = TELEPORT_NODES
): TeleportNode[] {
  return nodes.filter((n) => n.category === 'gatekeeper');
}
