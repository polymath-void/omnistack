/**
 * @omnistack/ast-engine - dependency-graph.ts
 * Component Dependency Graph (DAG) powered by graphlib.
 * Detects circular dependencies, generates topological execution orders,
 * and tracks upstream/downstream component dependencies.
 */

import graphlib from 'graphlib';
import type { ASTComponentMetadata } from '@omnistack/types';

// Support both ESM and CJS packaging environments
const resolvedGraphlib = (graphlib as any).default ?? graphlib;
const GraphClass = resolvedGraphlib.Graph as typeof graphlib.Graph;
const algModule = resolvedGraphlib.alg as typeof graphlib.alg;

export interface DependencyGraphSummary {
  totalComponents: number;
  totalDependencies: number;
  isAcyclic: boolean;
  cycles: string[][];
  topologicalOrder: string[];
}

/**
 * Manages an acyclic directed graph representing component relationships.
 */
export class ComponentDependencyGraph {
  private graph: graphlib.Graph;

  constructor() {
    this.graph = new GraphClass({ directed: true, multigraph: false });
  }

  /**
   * Registers a component node in the DAG.
   */
  public registerComponent(componentId: string, metadata?: Partial<ASTComponentMetadata>): void {
    if (!this.graph.hasNode(componentId)) {
      this.graph.setNode(componentId, metadata);
    } else if (metadata) {
      this.graph.setNode(componentId, metadata);
    }
  }

  /**
   * Records a directed dependency from dependent to dependency (dependent -> dependency).
   */
  public addDependency(dependentId: string, dependencyId: string): void {
    this.registerComponent(dependentId);
    this.registerComponent(dependencyId);
    this.graph.setEdge(dependentId, dependencyId);
  }

  /**
   * Builds the entire DAG from an array of ASTComponentMetadata objects.
   */
  public populateFromMetadata(components: ASTComponentMetadata[]): void {
    // 1. Register all component nodes
    for (const comp of components) {
      this.registerComponent(comp.componentName, comp);
    }

    // 2. Link dependencies based on imports
    for (const comp of components) {
      for (const depPath of comp.dependencies) {
        // Find matching component if the import refers to an internal component
        const match = components.find((c) => {
          const baseName = c.filePath.split(/[/|\\]/).pop()?.replace(/\.[^/.]+$/, '');
          return depPath.endsWith(`/${c.componentName}`) || depPath.endsWith(`/${baseName}`);
        });

        if (match) {
          this.addDependency(comp.componentName, match.componentName);
        }
      }
    }
  }

  /**
   * Determines if the component dependency graph is free of cycles.
   */
  public isAcyclic(): boolean {
    return algModule.isAcyclic(this.graph);
  }

  /**
   * Detects and returns any circular dependency loops in the graph.
   */
  public findCycles(): string[][] {
    return algModule.findCycles(this.graph);
  }

  /**
   * Returns a topological ordering of component compilation/rendering.
   * Throws if the graph contains cycles.
   */
  public getTopologicalOrder(): string[] {
    if (!this.isAcyclic()) {
      const cycles = this.findCycles();
      throw new Error(`Circular dependency detected: ${JSON.stringify(cycles)}`);
    }
    return algModule.topsort(this.graph);
  }

  /**
   * Returns immediate dependencies of a given component.
   */
  public getDirectDependencies(componentId: string): string[] {
    const successors = this.graph.successors(componentId);
    return successors || [];
  }

  /**
   * Returns immediate dependents of a given component (components that depend on this one).
   */
  public getDirectDependents(componentId: string): string[] {
    const predecessors = this.graph.predecessors(componentId);
    return predecessors || [];
  }

  /**
   * Returns the underlying graphlib Graph instance.
   */
  public getInternalGraph(): graphlib.Graph {
    return this.graph;
  }

  /**
   * Generates a structural summary of the component graph.
   */
  public getSummary(): DependencyGraphSummary {
    const isAcyclic = this.isAcyclic();
    const cycles = this.findCycles();
    let topologicalOrder: string[] = [];

    if (isAcyclic) {
      try {
        topologicalOrder = this.getTopologicalOrder();
      } catch {
        topologicalOrder = [];
      }
    }

    return {
      totalComponents: this.graph.nodeCount(),
      totalDependencies: this.graph.edgeCount(),
      isAcyclic,
      cycles,
      topologicalOrder,
    };
  }
}

/**
 * Builds a ComponentDependencyGraph directly from an array of ASTComponentMetadata.
 */
export function buildComponentDependencyGraph(
  components: ASTComponentMetadata[]
): ComponentDependencyGraph {
  const dag = new ComponentDependencyGraph();
  dag.populateFromMetadata(components);
  return dag;
}
