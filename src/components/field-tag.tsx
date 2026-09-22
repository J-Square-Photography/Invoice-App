/** Small italic marker beside a field label: "(Required)" or "(Optional)". */
export function FieldTag({ required }: { required?: boolean }) {
  return (
    <em className="ml-1.5 text-xs font-normal italic text-muted-foreground">
      {required ? '(Required)' : '(Optional)'}
    </em>
  );
}
