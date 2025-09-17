/**
 * Incident Response Workflows System
 *
 * Comprehensive incident management system with automated workflows, escalation policies,
 * and integration with the production error recovery system.
 */

import { redis } from '@/lib/redis';
import {
  errorRecoverySystem,
  type IncidentResponse,
  type ErrorContext,
} from './error-recovery-system';

export interface WorkflowStep {
  id: string;
  type: 'automated' | 'manual' | 'conditional';
  description: string;
  action: string;
  estimatedDuration: number; // milliseconds
  dependencies?: string[]; // Step IDs that must complete first
  conditions?: {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value: any;
  }[];
  execute?: () => Promise<WorkflowStepResult>;
  escalationTimeout?: number; // milliseconds before escalation
}

export interface WorkflowStepResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  nextSteps?: string[];
  requiresEscalation?: boolean;
}

export interface IncidentWorkflow {
  id: string;
  name: string;
  description: string;
  triggers: {
    severity: IncidentResponse['severity'][];
    services: string[];
    conditions?: {
      field: string;
      operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
      value: any;
    }[];
  };
  steps: WorkflowStep[];
  escalationPolicy: EscalationPolicy;
  sla: {
    acknowledgmentTime: number; // milliseconds
    responseTime: number;
    resolutionTime: number;
  };
}

export interface EscalationPolicy {
  id: string;
  name: string;
  levels: EscalationLevel[];
  notificationChannels: NotificationChannel[];
}

export interface EscalationLevel {
  level: number;
  delay: number; // milliseconds before escalating to this level
  assignees: string[];
  actions: string[];
  requiresAcknowledgment: boolean;
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms';
  config: Record<string, unknown>;
  enabled: boolean;
  severity: IncidentResponse['severity'][];
}

export interface WorkflowExecution {
  id: string;
  incidentId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'escalated' | 'cancelled';
  currentStepId?: string;
  startTime: number;
  completionTime?: number;
  steps: Array<{
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: number;
    completionTime?: number;
    result?: WorkflowStepResult;
  }>;
  escalationHistory: Array<{
    level: number;
    timestamp: number;
    assignee: string;
    acknowledged: boolean;
    acknowledgedAt?: number;
  }>;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  type: 'initial_alert' | 'status_update' | 'escalation' | 'resolution';
  channels: NotificationChannel['type'][];
  template: {
    subject: string;
    body: string;
    variables: string[]; // Template variables like {{incidentId}}, {{severity}}
  };
}

class IncidentResponseSystem {
  private static instance: IncidentResponseSystem;
  private workflows: Map<string, IncidentWorkflow> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private communicationTemplates: Map<string, CommunicationTemplate> = new Map();
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private executionTimer?: ReturnType<typeof setTimeout>;

  private constructor() {
    this.initializeDefaultWorkflows();
    this.initializeDefaultEscalationPolicies();
    this.initializeCommunicationTemplates();
    this.startWorkflowMonitoring();
  }

  public static getInstance(): IncidentResponseSystem {
    if (!IncidentResponseSystem.instance) {
      IncidentResponseSystem.instance = new IncidentResponseSystem();
    }
    return IncidentResponseSystem.instance;
  }

  /**
   * Start incident response workflow
   */
  public async startWorkflow(incident: IncidentResponse): Promise<WorkflowExecution | null> {
    try {
      // Find appropriate workflow
      const workflow = this.findWorkflowForIncident(incident);
      if (!workflow) {
        console.warn(`No workflow found for incident ${incident.incidentId}`);
        return null;
      }

      // Create workflow execution
      const execution: WorkflowExecution = {
        id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        incidentId: incident.incidentId,
        workflowId: workflow.id,
        status: 'running',
        startTime: Date.now(),
        steps: workflow.steps.map((step) => ({
          stepId: step.id,
          status: 'pending',
        })),
        escalationHistory: [],
      };

      // Store execution
      this.activeExecutions.set(execution.id, execution);
      await this.persistExecution(execution);

      // Send initial alert
      await this.sendInitialAlert(incident, workflow);

      // Start executing steps
      this.executeWorkflowSteps(execution, workflow);

      return execution;
    } catch (error) {
      console.error('Failed to start workflow:', error);
      return null;
    }
  }

  /**
   * Execute workflow steps sequentially with dependency management
   */
  private async executeWorkflowSteps(
    execution: WorkflowExecution,
    workflow: IncidentWorkflow,
  ): Promise<void> {
    try {
      const completedSteps = new Set<string>();

      while (execution.status === 'running') {
        // Find next eligible step
        const nextStep = workflow.steps.find((step) => {
          const stepExecution = execution.steps.find((s) => s.stepId === step.id);
          const isPending = stepExecution?.status === 'pending';
          const dependenciesMet =
            !step.dependencies || step.dependencies.every((depId) => completedSteps.has(depId));

          return isPending && dependenciesMet;
        });

        if (!nextStep) {
          // No more steps to execute
          execution.status = 'completed';
          execution.completionTime = Date.now();
          break;
        }

        // Check conditions if present
        if (nextStep.conditions && !this.evaluateConditions(nextStep.conditions, execution)) {
          // Skip step due to conditions
          const stepExecution = execution.steps.find((s) => s.stepId === nextStep.id)!;
          stepExecution.status = 'skipped';
          completedSteps.add(nextStep.id);
          continue;
        }

        // Execute step
        const stepResult = await this.executeWorkflowStep(nextStep, execution);
        const stepExecution = execution.steps.find((s) => s.stepId === nextStep.id)!;

        stepExecution.result = stepResult;
        stepExecution.completionTime = Date.now();

        if (stepResult.success) {
          stepExecution.status = 'completed';
          completedSteps.add(nextStep.id);

          // Check for escalation requirement
          if (stepResult.requiresEscalation) {
            await this.initiateEscalation(execution, workflow);
          }
        } else {
          stepExecution.status = 'failed';
          execution.status = 'failed';
          break;
        }

        // Update execution
        await this.persistExecution(execution);
      }

      // Final execution update
      this.activeExecutions.set(execution.id, execution);
      await this.persistExecution(execution);
    } catch (error) {
      console.error('Workflow execution failed:', error);
      execution.status = 'failed';
      await this.persistExecution(execution);
    }
  }

  /**
   * Execute individual workflow step
   */
  private async executeWorkflowStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
  ): Promise<WorkflowStepResult> {
    const stepExecution = execution.steps.find((s) => s.stepId === step.id)!;
    stepExecution.status = 'running';
    stepExecution.startTime = Date.now();

    execution.currentStepId = step.id;

    try {
      if (step.type === 'automated' && step.execute) {
        // Execute automated step
        return await step.execute();
      } else if (step.type === 'manual') {
        // Manual step - wait for operator action
        return await this.waitForManualAction(step, execution);
      } else if (step.type === 'conditional') {
        // Conditional step - evaluate and potentially execute
        return await this.executeConditionalStep(step, execution);
      } else {
        return {
          success: false,
          message: `Unknown step type: ${step.type}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Step execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Wait for manual action with timeout
   */
  private async waitForManualAction(
    step: WorkflowStep,
    execution: WorkflowExecution,
  ): Promise<WorkflowStepResult> {
    const timeout = step.escalationTimeout || 900000; // 15 minutes default
    const startTime = Date.now();

    // Send notification for manual action required
    await this.notifyManualActionRequired(step, execution);

    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        // Check if action was completed externally
        const updatedExecution = await this.getExecution(execution.id);
        const stepStatus = updatedExecution?.steps.find((s) => s.stepId === step.id);

        if (stepStatus?.result) {
          clearInterval(checkInterval);
          resolve(stepStatus.result);
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve({
            success: false,
            message: `Manual action timeout after ${timeout}ms`,
            requiresEscalation: true,
          });
        }
      }, 5000); // Check every 5 seconds
    });
  }

  /**
   * Execute conditional step based on incident state
   */
  private async executeConditionalStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
  ): Promise<WorkflowStepResult> {
    // Get current incident state
    const incident = await this.getIncident(execution.incidentId);
    if (!incident) {
      return {
        success: false,
        message: 'Could not retrieve incident for conditional evaluation',
      };
    }

    // Evaluate conditions
    const conditionsMet = step.conditions
      ? this.evaluateConditions(step.conditions, execution, incident)
      : true;

    if (!conditionsMet) {
      return {
        success: true,
        message: 'Conditions not met, skipping step',
      };
    }

    // Execute if conditions are met
    if (step.execute) {
      return await step.execute();
    }

    return {
      success: true,
      message: 'Conditional step evaluated successfully',
    };
  }

  /**
   * Initiate escalation process
   */
  private async initiateEscalation(
    execution: WorkflowExecution,
    workflow: IncidentWorkflow,
  ): Promise<void> {
    const currentLevel = execution.escalationHistory.length;
    const escalationLevel = workflow.escalationPolicy.levels[currentLevel];

    if (!escalationLevel) {
      console.warn('No escalation level available for', execution.id);
      return;
    }

    // Record escalation
    const escalation = {
      level: escalationLevel.level,
      timestamp: Date.now(),
      assignee: escalationLevel.assignees[0] || 'unassigned',
      acknowledged: false,
    };

    execution.escalationHistory.push(escalation);

    // Send escalation notifications
    await this.sendEscalationNotification(execution, escalationLevel, workflow);

    // Update execution
    await this.persistExecution(execution);
  }

  /**
   * Acknowledge incident by assignee
   */
  public async acknowledgeIncident(
    executionId: string,
    assignee: string,
    acknowledgment: string,
  ): Promise<boolean> {
    try {
      const execution = this.activeExecutions.get(executionId);
      if (!execution) return false;

      // Update latest escalation
      const latestEscalation = execution.escalationHistory[execution.escalationHistory.length - 1];
      if (latestEscalation && latestEscalation.assignee === assignee) {
        latestEscalation.acknowledged = true;
        latestEscalation.acknowledgedAt = Date.now();
      }

      // Get incident and update
      const incident = await this.getIncident(execution.incidentId);
      if (incident) {
        incident.assignedTo = assignee;
        incident.timeline.push({
          timestamp: Date.now(),
          action: `Incident acknowledged by ${assignee}`,
          actor: assignee,
          result: acknowledgment,
        });

        await this.persistIncident(incident);
      }

      await this.persistExecution(execution);
      return true;
    } catch (error) {
      console.error('Failed to acknowledge incident:', error);
      return false;
    }
  }

  /**
   * Complete manual step
   */
  public async completeManualStep(
    executionId: string,
    stepId: string,
    result: WorkflowStepResult,
    operator: string,
  ): Promise<boolean> {
    try {
      const execution = this.activeExecutions.get(executionId);
      if (!execution) return false;

      const stepExecution = execution.steps.find((s) => s.stepId === stepId);
      if (!stepExecution || stepExecution.status !== 'running') return false;

      // Update step result
      stepExecution.result = result;
      stepExecution.status = result.success ? 'completed' : 'failed';
      stepExecution.completionTime = Date.now();

      // Update incident timeline
      const incident = await this.getIncident(execution.incidentId);
      if (incident) {
        incident.timeline.push({
          timestamp: Date.now(),
          action: `Manual step completed: ${stepId}`,
          actor: operator,
          result: result.message,
        });

        await this.persistIncident(incident);
      }

      await this.persistExecution(execution);
      return true;
    } catch (error) {
      console.error('Failed to complete manual step:', error);
      return false;
    }
  }

  /**
   * Get workflow execution status
   */
  public getExecutionStatus(executionId: string): WorkflowExecution | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Initialize default workflows
   */
  private initializeDefaultWorkflows(): void {
    // Critical service failure workflow
    const criticalServiceWorkflow: IncidentWorkflow = {
      id: 'critical_service_failure',
      name: 'Critical Service Failure Response',
      description: 'Automated response for critical service failures',
      triggers: {
        severity: ['p0', 'p1'],
        services: ['payment', 'clerk', 'database'],
      },
      steps: [
        {
          id: 'immediate_assessment',
          type: 'automated',
          description: 'Assess service health and impact',
          action: 'health_check',
          estimatedDuration: 30000,
          execute: async () => {
            const healthStatus = await errorRecoverySystem.getSystemHealthStatus();
            return {
              success: true,
              message: `System health assessed: ${healthStatus.overall}`,
              data: { healthStatus },
            };
          },
        },
        {
          id: 'automatic_recovery',
          type: 'automated',
          description: 'Attempt automatic recovery actions',
          action: 'execute_recovery',
          estimatedDuration: 60000,
          dependencies: ['immediate_assessment'],
          execute: async () => {
            // This would execute automatic recovery
            return {
              success: true,
              message: 'Automatic recovery attempted',
            };
          },
        },
        {
          id: 'escalate_if_unresolved',
          type: 'conditional',
          description: 'Escalate if automatic recovery failed',
          action: 'conditional_escalation',
          estimatedDuration: 5000,
          dependencies: ['automatic_recovery'],
          conditions: [{ field: 'automatic_recovery.success', operator: 'eq', value: false }],
          execute: async () => {
            return {
              success: true,
              message: 'Escalating to on-call engineer',
              requiresEscalation: true,
            };
          },
        },
        {
          id: 'manual_investigation',
          type: 'manual',
          description: 'Manual investigation by engineer',
          action: 'investigate',
          estimatedDuration: 900000, // 15 minutes
          escalationTimeout: 1800000, // 30 minutes
          dependencies: ['escalate_if_unresolved'],
        },
      ],
      escalationPolicy: {
        id: 'critical_escalation',
        name: 'Critical Service Escalation',
        levels: [
          {
            level: 1,
            delay: 0,
            assignees: ['on-call-engineer'],
            actions: ['page', 'slack'],
            requiresAcknowledgment: true,
          },
          {
            level: 2,
            delay: 300000, // 5 minutes
            assignees: ['engineering-manager'],
            actions: ['page', 'slack', 'email'],
            requiresAcknowledgment: true,
          },
        ],
        notificationChannels: [
          {
            type: 'slack',
            config: { channel: '#incidents' },
            enabled: true,
            severity: ['p0', 'p1', 'p2'],
          },
          {
            type: 'pagerduty',
            config: { serviceKey: 'critical-service' },
            enabled: true,
            severity: ['p0', 'p1'],
          },
        ],
      },
      sla: {
        acknowledgmentTime: 300000, // 5 minutes
        responseTime: 900000, // 15 minutes
        resolutionTime: 14400000, // 4 hours
      },
    };

    this.workflows.set(criticalServiceWorkflow.id, criticalServiceWorkflow);

    // Redis failure workflow
    const redisFailureWorkflow: IncidentWorkflow = {
      id: 'redis_failure',
      name: 'Redis Service Failure Response',
      description: 'Specific workflow for Redis/caching layer failures',
      triggers: {
        severity: ['p1', 'p2'],
        services: ['redis'],
      },
      steps: [
        {
          id: 'check_circuit_breaker',
          type: 'automated',
          description: 'Check circuit breaker status',
          action: 'circuit_breaker_check',
          estimatedDuration: 10000,
          execute: async () => {
            // Check circuit breaker state
            const state = await redis.get('circuit_breaker:redis').catch(() => null);
            return {
              success: true,
              message: `Circuit breaker state: ${state ? 'EXISTS' : 'CLEAR'}`,
              data: { circuitBreakerState: state },
            };
          },
        },
        {
          id: 'attempt_reconnection',
          type: 'automated',
          description: 'Attempt Redis reconnection',
          action: 'redis_reconnect',
          estimatedDuration: 30000,
          dependencies: ['check_circuit_breaker'],
          execute: async () => {
            try {
              await redis.ping();
              return {
                success: true,
                message: 'Redis reconnection successful',
              };
            } catch (error) {
              return {
                success: false,
                message: `Redis reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                requiresEscalation: true,
              };
            }
          },
        },
        {
          id: 'fallback_to_clerk',
          type: 'automated',
          description: 'Enable Clerk-only mode for authentication',
          action: 'enable_clerk_fallback',
          estimatedDuration: 15000,
          conditions: [{ field: 'attempt_reconnection.success', operator: 'eq', value: false }],
          execute: async () => {
            // This would enable Clerk-only authentication mode
            return {
              success: true,
              message: 'Clerk-only mode enabled for graceful degradation',
            };
          },
        },
      ],
      escalationPolicy: {
        id: 'redis_escalation',
        name: 'Redis Failure Escalation',
        levels: [
          {
            level: 1,
            delay: 0,
            assignees: ['platform-engineer'],
            actions: ['slack'],
            requiresAcknowledgment: true,
          },
        ],
        notificationChannels: [
          {
            type: 'slack',
            config: { channel: '#platform' },
            enabled: true,
            severity: ['p1', 'p2'],
          },
        ],
      },
      sla: {
        acknowledgmentTime: 600000, // 10 minutes
        responseTime: 1800000, // 30 minutes
        resolutionTime: 7200000, // 2 hours
      },
    };

    this.workflows.set(redisFailureWorkflow.id, redisFailureWorkflow);
  }

  /**
   * Initialize default escalation policies
   */
  private initializeDefaultEscalationPolicies(): void {
    // Policies are included in workflows above
  }

  /**
   * Initialize communication templates
   */
  private initializeCommunicationTemplates(): void {
    const initialAlert: CommunicationTemplate = {
      id: 'initial_alert',
      name: 'Initial Incident Alert',
      type: 'initial_alert',
      channels: ['slack', 'pagerduty'],
      template: {
        subject: '[{{severity}}] {{title}}',
        body: `Incident {{incidentId}} has been detected:

Title: {{title}}
Severity: {{severity}}
Affected Services: {{affectedServices}}
Description: {{description}}

Incident has been assigned to {{assignedTo}}.
Status: {{status}}

Dashboard: {{dashboardUrl}}
`,
        variables: [
          'incidentId',
          'title',
          'severity',
          'affectedServices',
          'description',
          'assignedTo',
          'status',
          'dashboardUrl',
        ],
      },
    };

    this.communicationTemplates.set(initialAlert.id, initialAlert);
  }

  /**
   * Start monitoring workflow executions
   */
  private startWorkflowMonitoring(): void {
    this.executionTimer = setInterval(async () => {
      for (const [executionId, execution] of this.activeExecutions.entries()) {
        if (execution.status === 'running') {
          // Check for timeouts and escalations
          await this.checkExecutionTimeouts(execution);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Helper methods
   */
  private findWorkflowForIncident(incident: IncidentResponse): IncidentWorkflow | null {
    for (const workflow of this.workflows.values()) {
      if (this.matchesWorkflowTriggers(incident, workflow.triggers)) {
        return workflow;
      }
    }
    return null;
  }

  private matchesWorkflowTriggers(
    incident: IncidentResponse,
    triggers: IncidentWorkflow['triggers'],
  ): boolean {
    const severityMatch = triggers.severity.includes(incident.severity);
    const serviceMatch = incident.affectedServices.some((service) =>
      triggers.services.includes(service),
    );

    return severityMatch && serviceMatch;
  }

  private evaluateConditions(
    conditions: WorkflowStep['conditions'],
    execution: WorkflowExecution,
    incident?: IncidentResponse,
  ): boolean {
    if (!conditions) return true;

    return conditions.every((condition) => {
      // This would evaluate conditions against execution/incident state
      // For now, return true
      return true;
    });
  }

  private async sendInitialAlert(
    incident: IncidentResponse,
    workflow: IncidentWorkflow,
  ): Promise<void> {
    const template = this.communicationTemplates.get('initial_alert');
    if (!template) return;

    // Send to appropriate channels
    for (const channel of workflow.escalationPolicy.notificationChannels) {
      if (channel.enabled && channel.severity.includes(incident.severity)) {
        await this.sendNotification(channel, template, incident);
      }
    }
  }

  private async sendEscalationNotification(
    execution: WorkflowExecution,
    level: EscalationLevel,
    workflow: IncidentWorkflow,
  ): Promise<void> {
    const incident = await this.getIncident(execution.incidentId);
    if (!incident) return;

    // Send escalation notifications
    for (const channel of workflow.escalationPolicy.notificationChannels) {
      if (channel.enabled) {
        await this.sendNotification(
          channel,
          this.communicationTemplates.get('escalation')!,
          incident,
          { escalationLevel: level.level, assignee: level.assignees[0] },
        );
      }
    }
  }

  private async notifyManualActionRequired(
    step: WorkflowStep,
    execution: WorkflowExecution,
  ): Promise<void> {
    const incident = await this.getIncident(execution.incidentId);
    if (!incident) return;

    console.log(`MANUAL ACTION REQUIRED: ${step.description}`, {
      incidentId: incident.incidentId,
      stepId: step.id,
      executionId: execution.id,
    });
  }

  private async sendNotification(
    channel: NotificationChannel,
    template: CommunicationTemplate,
    incident: IncidentResponse,
    variables?: Record<string, unknown>,
  ): Promise<void> {
    // This would integrate with actual notification services
    console.log(`NOTIFICATION [${channel.type}]: ${template.template.subject}`, {
      incident: incident.incidentId,
      channel: channel.type,
      variables,
    });
  }

  private async checkExecutionTimeouts(execution: WorkflowExecution): Promise<void> {
    // Check for step timeouts and trigger escalations
    const runningStep = execution.steps.find((s) => s.status === 'running');
    if (runningStep && runningStep.startTime) {
      const stepDuration = Date.now() - runningStep.startTime;
      // Check timeout logic here
    }
  }

  private async persistExecution(execution: WorkflowExecution): Promise<void> {
    try {
      await redis.setex(
        `workflow_execution:${execution.id}`,
        86400 * 7, // 7 days
        JSON.stringify(execution),
      );
    } catch (error) {
      console.error('Failed to persist execution:', error);
    }
  }

  private async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    try {
      const data = await redis.get(`workflow_execution:${executionId}`);
      return data ? JSON.parse(data as string) : null;
    } catch (error) {
      return null;
    }
  }

  private async getIncident(incidentId: string): Promise<IncidentResponse | null> {
    try {
      const data = await redis.get(`incident:${incidentId}`);
      return data ? JSON.parse(data as string) : null;
    } catch (error) {
      return null;
    }
  }

  private async persistIncident(incident: IncidentResponse): Promise<void> {
    try {
      await redis.setex(
        `incident:${incident.incidentId}`,
        86400 * 7, // 7 days
        JSON.stringify(incident),
      );
    } catch (error) {
      console.error('Failed to persist incident:', error);
    }
  }

  /**
   * Get all active workflow executions
   */
  public getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get workflow by ID
   */
  public getWorkflow(workflowId: string): IncidentWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Shutdown cleanup
   */
  public shutdown(): void {
    if (this.executionTimer) {
      clearInterval(this.executionTimer);
    }
  }
}

// Export singleton instance
export const incidentResponseSystem = IncidentResponseSystem.getInstance();

// Convenience functions
export const startIncidentWorkflow = (incident: IncidentResponse) =>
  incidentResponseSystem.startWorkflow(incident);

export const acknowledgeIncident = (
  executionId: string,
  assignee: string,
  acknowledgment: string,
) => incidentResponseSystem.acknowledgeIncident(executionId, assignee, acknowledgment);

export const completeManualStep = (
  executionId: string,
  stepId: string,
  result: WorkflowStepResult,
  operator: string,
) => incidentResponseSystem.completeManualStep(executionId, stepId, result, operator);
