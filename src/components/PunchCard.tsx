import {
  useGetTodayAttendance,
  usePunchIn,
  usePunchOut,
  getGetTodayAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function durationStr(inIso: string, outIso: string | null | undefined) {
  const end = outIso ? new Date(outIso).getTime() : Date.now();
  const ms = end - new Date(inIso).getTime();
  if (ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function PunchCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = getGetTodayAttendanceQueryKey();
  const { data, isLoading } = useGetTodayAttendance({ query: { queryKey: key } });
  const punchIn = usePunchIn();
  const punchOut = usePunchOut();

  const att = (data ?? null) as null | {
    punchInAt?: string | null;
    punchOutAt?: string | null;
    status?: string;
  };

  const handlePunchIn = async () => {
    try {
      await punchIn.mutateAsync();
      await qc.invalidateQueries({ queryKey: key });
      toast({ title: "Punched in", description: "Have a productive day!" });
    } catch {
      toast({ title: "Punch-in failed", variant: "destructive" });
    }
  };

  const handlePunchOut = async () => {
    try {
      await punchOut.mutateAsync();
      await qc.invalidateQueries({ queryKey: key });
      toast({ title: "Punched out", description: "See you tomorrow!" });
    } catch {
      toast({ title: "Punch-out failed", variant: "destructive" });
    }
  };

  const inAt = att?.punchInAt ?? null;
  const outAt = att?.punchOutAt ?? null;
  const isWorking = !!inAt && !outAt;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" /> Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">Punch In</p>
                <p className="font-semibold text-foreground">{formatTime(inAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">Punch Out</p>
                <p className="font-semibold text-foreground">{formatTime(outAt)}</p>
              </div>
              {inAt && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Worked</p>
                  <p className="font-semibold text-foreground">{durationStr(inAt, outAt)}</p>
                </div>
              )}
              {isWorking && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                  On the clock
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {!inAt && (
                <Button size="sm" onClick={handlePunchIn} disabled={punchIn.isPending}>
                  <LogIn className="w-4 h-4 mr-1" /> Punch In
                </Button>
              )}
              {inAt && !outAt && (
                <Button size="sm" variant="destructive" onClick={handlePunchOut} disabled={punchOut.isPending}>
                  <LogOut className="w-4 h-4 mr-1" /> Punch Out
                </Button>
              )}
              {inAt && outAt && (
                <span className="text-xs text-muted-foreground">Day complete</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
