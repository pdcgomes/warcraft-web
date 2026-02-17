/**
 * Components are pure data containers attached to entities.
 * Each component type is identified by a unique string tag.
 */
export interface Component {
  readonly type: string;
}

export type ComponentType = string;

/**
 * A ComponentClass is a constructor that produces Component instances.
 * The static `type` field uniquely identifies the component.
 */
export interface ComponentClass<T extends Component = Component> {
  new (...args: any[]): T;
  readonly type: string;
}
