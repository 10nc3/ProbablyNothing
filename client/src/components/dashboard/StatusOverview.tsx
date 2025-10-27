import { Configuration, ProcessingStatus } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Calendar, MessageCircle, AlertCircle } from "lucide-react";

interface StatusOverviewProps {
  status?: ProcessingStatus;
  config?: Configuration;
  isLoading: boolean;
}

export function StatusOverview({ status, config, isLoading }: StatusOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const isActive = config?.isActive ?? false;
  const messagesProcessed = status?.messagesProcessed ?? 0;
  const eventsCreated = status?.eventsCreated ?? 0;
  const errors = status?.errors ?? 0;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Bot Status */}
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                isActive ? "bg-green-500" : "bg-gray-400"
              }`}
              data-testid="status-bot-indicator"
            />
            <span className="text-2xl font-bold" data-testid="text-bot-status">
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {status?.lastChecked && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Messages Processed */}
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Messages</CardTitle>
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-messages-count">{messagesProcessed}</div>
          <p className="text-xs text-muted-foreground">Total processed</p>
        </CardContent>
      </Card>

      {/* Events Created */}
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Events</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-events-count">{eventsCreated}</div>
          <p className="text-xs text-muted-foreground">Calendar events</p>
        </CardContent>
      </Card>

      {/* Errors */}
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Errors</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-errors-count">{errors}</div>
          <p className="text-xs text-muted-foreground">Failed to process</p>
        </CardContent>
      </Card>
    </div>
  );
}
