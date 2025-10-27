import { MessageWithEvent } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Calendar, CheckCircle2, XCircle, Clock, MapPin, Users } from "lucide-react";

interface MessageHistorySectionProps {
  messages?: MessageWithEvent[];
  isLoading: boolean;
}

export function MessageHistorySection({ messages, isLoading }: MessageHistorySectionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
          <CardDescription>
            Recent WhatsApp messages and their processing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              When you receive WhatsApp messages with your configured Twilio number, they'll appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message History</CardTitle>
        <CardDescription>
          Recent WhatsApp messages and their processing status ({messages.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border p-4 hover-elevate transition-all"
                data-testid={`message-${message.id}`}
              >
                {/* Message Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono text-muted-foreground">
                        {message.from}
                      </span>
                    </div>
                    <p className="text-sm">{message.body}</p>
                  </div>
                  <Badge
                    variant={
                      message.status === "processed"
                        ? "default"
                        : message.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                    data-testid={`badge-status-${message.id}`}
                  >
                    {message.status === "processed" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                    {message.status === "failed" && <XCircle className="mr-1 h-3 w-3" />}
                    {message.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                    {message.status}
                  </Badge>
                </div>

                {/* Message Meta */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span>
                    Received: {new Date(message.receivedAt).toLocaleString()}
                  </span>
                  {message.processedAt && (
                    <span>
                      Processed: {new Date(message.processedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Event Details (if processed) */}
                {message.event && (
                  <div className="mt-3 pt-3 border-t bg-muted/30 -mx-4 -mb-4 p-4 rounded-b-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-semibold text-sm">{message.event.title}</h4>
                        <div className="grid gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>
                              {new Date(message.event.startTime).toLocaleString()}
                              {message.event.endTime && ` - ${new Date(message.event.endTime).toLocaleTimeString()}`}
                            </span>
                          </div>
                          {message.event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" />
                              <span>{message.event.location}</span>
                            </div>
                          )}
                          {message.event.attendees && message.event.attendees.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3" />
                              <span>{message.event.attendees.join(", ")}</span>
                            </div>
                          )}
                        </div>
                        {message.event.description && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {message.event.description}
                          </p>
                        )}
                        <Badge variant="outline" className="mt-2">
                          {message.event.calendarService}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message (if failed) */}
                {message.status === "failed" && message.errorMessage && (
                  <div className="mt-3 pt-3 border-t bg-destructive/10 -mx-4 -mb-4 p-4 rounded-b-lg">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive mb-1">Error</p>
                        <p className="text-xs text-muted-foreground">{message.errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
