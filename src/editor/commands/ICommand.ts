export interface ICommand {
    id: string;
    timestamp: number;
    description: string;
    execute(): void;
    undo(): void;
}
