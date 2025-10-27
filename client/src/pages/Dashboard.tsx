import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Configuration, MessageWithEvent, ProcessingStatus } from "@shared/schema";
import { ConfigurationSection } from "@/components/dashboard/ConfigurationSection";
import { FlowchartSection } from "@/components/dashboard/FlowchartSection";
import { MessageHistorySection } from "@/components/dashboard/MessageHistorySection";
import { StatusOverview } from "@/components/dashboard/StatusOverview";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, BarChart3, MessageSquare } from "lucide-react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: config, isLoading: configLoading } = useQuery<Configuration>({
    queryKey: ["/api/configuration"],
  });

  const { data: status, isLoading: statusLoading } = useQuery<ProcessingStatus>({
    queryKey: ["/api/status"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<MessageWithEvent[]>({
    queryKey: ["/api/messages"],
    refetchInterval: activeTab === "messages" ? 15000 : false,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold" data-testid="text-app-title">WhatsApp to Calendar Bot</h1>
              <p className="text-xs text-muted-foreground">Automated event creation</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Status Overview */}
          <StatusOverview status={status} config={config} isLoading={statusLoading || configLoading} />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="configuration" className="gap-2" data-testid="tab-configuration">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Configuration</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-2" data-testid="tab-messages">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <FlowchartSection config={config} />
            </TabsContent>

            <TabsContent value="configuration" className="space-y-6">
              <ConfigurationSection config={config} isLoading={configLoading} />
            </TabsContent>

            <TabsContent value="messages" className="space-y-6">
              <MessageHistorySection messages={messages} isLoading={messagesLoading} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
