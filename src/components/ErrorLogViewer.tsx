import { useError } from '@/contexts/ErrorContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';

export function ErrorLogViewer() {
  const { errors, clearErrors } = useError();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Terminal className="h-4 w-4" />
          Logs
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Fehler-Logs</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-grow my-4 pr-4">
          {errors.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Bisher keine Fehler aufgetreten.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {errors.map((error) => (
                <div key={error.id} className="p-3 rounded-md border bg-muted/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-sm text-destructive break-all">{error.message}</p>
                    <Badge variant={error.source === 'UI' ? 'destructive' : 'secondary'}>{error.source}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {error.timestamp.toLocaleTimeString()}
                  </p>
                  <pre className="text-xs bg-background p-2 rounded-sm overflow-x-auto">
                    <code>{typeof error.details === 'string' ? error.details : JSON.stringify(error.details, null, 2)}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <SheetFooter>
          <Button variant="outline" onClick={clearErrors} disabled={errors.length === 0}>
            <Trash2 className="mr-2 h-4 w-4" />
            Logs löschen
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}