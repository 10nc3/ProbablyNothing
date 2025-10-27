import { Configuration } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Smartphone, Brain, Calendar, CheckCircle2, ArrowRight } from "lucide-react";

interface FlowchartSectionProps {
  config?: Configuration;
}

export function FlowchartSection({ config }: FlowchartSectionProps) {
  const calendarService = config?.calendarService || "google";
  
  const nodes = [
    {
      icon: MessageSquare,
      title: "WhatsApp Message",
      description: "User sends invite via WhatsApp",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-950",
    },
    {
      icon: Smartphone,
      title: "Twilio Webhook",
      description: "Message received via Twilio API",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-950",
    },
    {
      icon: Brain,
      title: "AI Parser",
      description: "OpenAI extracts event details",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-950",
    },
    {
      icon: Calendar,
      title: "Calendar Service",
      description: `Event created in ${calendarService === "google" ? "Google Calendar" : calendarService === "outlook" ? "Outlook" : "Custom Endpoint"}`,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-950",
    },
    {
      icon: CheckCircle2,
      title: "Confirmation",
      description: "Event added to calendar",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-950",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing Flow</CardTitle>
        <CardDescription>
          Visual representation of how WhatsApp messages are converted into calendar events
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Desktop Flow - Horizontal */}
        <div className="hidden lg:block">
          <div className="flex items-center justify-between gap-4">
            {nodes.map((node, index) => (
              <div key={index} className="flex items-center gap-4 flex-1">
                <div className="flex flex-col items-center gap-3 flex-1">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-lg ${node.bgColor} transition-all hover-elevate`}
                    data-testid={`flowchart-node-${index}`}
                  >
                    <node.icon className={`h-8 w-8 ${node.color}`} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-sm font-semibold">{node.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{node.description}</p>
                  </div>
                </div>
                {index < nodes.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Flow - Vertical */}
        <div className="lg:hidden space-y-4">
          {nodes.map((node, index) => (
            <div key={index} className="space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${node.bgColor}`}
                >
                  <node.icon className={`h-6 w-6 ${node.color}`} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold">{node.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{node.description}</p>
                </div>
              </div>
              {index < nodes.length - 1 && (
                <div className="ml-6 border-l-2 border-dashed border-muted h-6" />
              )}
            </div>
          ))}
        </div>

        {/* Technical Details */}
        <div className="mt-8 pt-6 border-t">
          <h4 className="text-sm font-semibold mb-3">Technical Stack</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" data-testid="badge-tech-twilio">Twilio WhatsApp API</Badge>
            <Badge variant="secondary" data-testid="badge-tech-openai">OpenAI GPT-5</Badge>
            <Badge variant="secondary" data-testid="badge-tech-calendar">{calendarService === "google" ? "Google Calendar" : calendarService === "outlook" ? "Outlook API" : "Custom Webhook"}</Badge>
            <Badge variant="secondary" data-testid="badge-tech-polling">Time-based Polling</Badge>
            <Badge variant="secondary" data-testid="badge-tech-ai">AI-Powered Parsing</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
