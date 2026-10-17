// Only used when the adapter knows no device write was dispatched.
export class CommandRejectedError extends Error {
  constructor(message = 'Command rejected before dispatch') { super(message); this.name = 'CommandRejectedError'; }
}
