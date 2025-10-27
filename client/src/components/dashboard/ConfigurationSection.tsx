import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Configuration, insertConfigurationSchema } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff, Save, CheckCircle2, AlertCircle } from "lucide-react";

interface ConfigurationSectionProps {
  config?: Configuration;
  isLoading: boolean;
}

export function ConfigurationSection({ config, isLoading }: ConfigurationSectionProps) {
  const { toast } = useToast();
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const form = useForm({
    resolver: zodResolver(insertConfigurationSchema),
    defaultValues: {
      userId: "default",
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioWhatsappNumber: "",
      calendarService: "google",
      calendarEndpoint: "",
      calendarAccessToken: "",
      pollingInterval: "5",
      isActive: false,
    },
  });

  // Reset form when config data loads or changes
  useEffect(() => {
    form.reset({
      userId: config?.userId ?? "default",
      twilioAccountSid: config?.twilioAccountSid ?? "",
      twilioAuthToken: config?.twilioAuthToken ?? "",
      twilioWhatsappNumber: config?.twilioWhatsappNumber ?? "",
      calendarService: config?.calendarService ?? "google",
      calendarEndpoint: config?.calendarEndpoint ?? "",
      calendarAccessToken: config?.calendarAccessToken ?? "",
      pollingInterval: config?.pollingInterval ?? "5",
      isActive: config?.isActive ?? false,
    });
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/configuration", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configuration"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
      toast({
        title: "Configuration saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save configuration. Please try again.",
      });
    },
  });

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await apiRequest("POST", "/api/test-connection", {
        twilioAccountSid: form.getValues("twilioAccountSid"),
        twilioAuthToken: form.getValues("twilioAuthToken"),
      });
      
      toast({
        title: "Connection successful",
        description: "Twilio credentials are valid!",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "Please check your Twilio credentials.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Twilio Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Twilio WhatsApp Setup</CardTitle>
            <CardDescription>
              Configure your Twilio credentials to receive WhatsApp messages. Get these from your Twilio console.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="twilioAccountSid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account SID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="font-mono text-sm"
                      data-testid="input-twilio-sid"
                    />
                  </FormControl>
                  <FormDescription>
                    Your Twilio Account SID (starts with "AC")
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="twilioAuthToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auth Token</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showTwilioToken ? "text" : "password"}
                        placeholder="••••••••••••••••••••••••••••••••"
                        className="font-mono text-sm pr-10"
                        data-testid="input-twilio-token"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowTwilioToken(!showTwilioToken)}
                        data-testid="button-toggle-token-visibility"
                      >
                        {showTwilioToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Your Twilio Auth Token (kept secure and hidden)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="twilioWhatsappNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="whatsapp:+14155238886"
                      className="font-mono text-sm"
                      data-testid="input-whatsapp-number"
                    />
                  </FormControl>
                  <FormDescription>
                    Your Twilio WhatsApp number (format: whatsapp:+1234567890)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={testingConnection || !form.watch("twilioAccountSid") || !form.watch("twilioAuthToken")}
              data-testid="button-test-connection"
            >
              {testingConnection ? (
                <>Testing...</>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Calendar Integration */}
        <Card>
          <CardHeader>
            <CardTitle>Calendar Integration</CardTitle>
            <CardDescription>
              Choose your calendar service and configure the endpoint
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="calendarService"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calendar Service</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-calendar-service">
                        <SelectValue placeholder="Select a calendar service" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="google">Google Calendar</SelectItem>
                      <SelectItem value="outlook">Outlook Calendar</SelectItem>
                      <SelectItem value="custom">Custom Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Toggle between different calendar providers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("calendarService") === "custom" && (
              <FormField
                control={form.control}
                name="calendarEndpoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Endpoint URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://your-endpoint.com/webhook"
                        className="font-mono text-sm"
                        data-testid="input-custom-endpoint"
                      />
                    </FormControl>
                    <FormDescription>
                      Your custom webhook endpoint for calendar events
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(form.watch("calendarService") === "google" || form.watch("calendarService") === "outlook") && (
              <FormField
                control={form.control}
                name="calendarAccessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OAuth Access Token</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter your OAuth token"
                        className="font-mono text-sm"
                        data-testid="input-oauth-token"
                      />
                    </FormControl>
                    <FormDescription>
                      OAuth token for {form.watch("calendarService") === "google" ? "Google" : "Outlook"} Calendar API
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Bot Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Bot Behavior</CardTitle>
            <CardDescription>
              Configure how the bot processes WhatsApp messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="pollingInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Polling Interval (minutes)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-polling-interval">
                        <SelectValue placeholder="Select interval" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Every 1 minute</SelectItem>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                      <SelectItem value="10">Every 10 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="60">Every hour</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How often to check for new WhatsApp messages
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Activate Bot</FormLabel>
                    <FormDescription>
                      Enable automatic message processing
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-activate-bot"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={saveMutation.isPending}
            data-testid="button-save-configuration"
          >
            {saveMutation.isPending ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
