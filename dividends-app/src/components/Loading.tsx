interface Props {
  message?: string;
}

export function Loading({ message = 'Loading...' }: Props) {
  return (
    <div className="loading">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
}
