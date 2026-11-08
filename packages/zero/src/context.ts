/**
 * What the API knows about the request, passed to every query and mutator.
 * The web app passes the same value to Zero, so client-side runs match.
 */
export type ZeroContext = {
  /** The signed-in user, from the Better Auth session. */
  readonly userID: string;
};

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    context: ZeroContext;
  }
}
