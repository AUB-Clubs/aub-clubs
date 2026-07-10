import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listClubs, listClubsInput } from './tools/listClubs.js';
import { listClubCategories, listClubCategoriesInput } from './tools/listClubCategories.js';
import { getClub, getClubInput } from './tools/getClub.js';
import { listClubEvents, listClubEventsInput } from './tools/listClubEvents.js';
import { listRecentEvents, listRecentEventsInput } from './tools/listRecentEvents.js';
import { listClubPosts, listClubPostsInput } from './tools/listClubPosts.js';
import { listRecentAnnouncements, listRecentAnnouncementsInput } from './tools/listRecentAnnouncements.js';
import { listClubMeetings, listClubMeetingsInput } from './tools/listClubMeetings.js';
import { logger } from './logger.js';

function asTextResult(payload: unknown) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function summarizeResult(result: unknown) {
  if (Array.isArray(result)) {
    return { resultType: 'array', itemCount: result.length };
  }
  if (result && typeof result === 'object') {
    return { resultType: 'object', keyCount: Object.keys(result).length };
  }
  return { resultType: typeof result };
}

function wrap<TArgs, TResult>(toolName: string, fn: (args: TArgs) => Promise<TResult>) {
  return async (args: TArgs) => {
    const startedAt = Date.now();
    logger.info('tool invocation started', {
      toolName,
      args,
    });
    try {
      const result = await fn(args);
      logger.info('tool invocation succeeded', {
        toolName,
        durationMs: Date.now() - startedAt,
        ...summarizeResult(result),
      });
      return asTextResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('tool invocation failed', {
        toolName,
        args,
        durationMs: Date.now() - startedAt,
        error: err,
      });
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
      };
    }
  };
}

export function buildMcpServer(): McpServer {
  logger.info('building MCP server instance');
  const server = new McpServer(
    { name: 'aub-clubs-mcp-server', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    'list_club_categories',
    {
      description:
        'List all available club categories (types) with friendly labels and descriptions. Call this first to understand which categories exist and to map a student interest to one or more category values that other tools accept.',
      inputSchema: listClubCategoriesInput,
    },
    wrap('list_club_categories', listClubCategories) as never,
  );

  server.registerTool(
    'list_clubs',
    {
      description:
        'List discoverable AUB clubs (all non-inactive clubs). Supports free-text search (title/description/mission) and filtering by club types. Returns status and member counts.',
      inputSchema: listClubsInput,
    },
    wrap('list_clubs', listClubs) as never,
  );

  server.registerTool(
    'get_club',
    {
      description:
        'Get full public details for a single discoverable club by id (UUID) or crn (number). Includes status, contact links, member count, and number of upcoming events.',
      inputSchema: getClubInput,
    },
    wrap('get_club', getClub) as never,
  );

  server.registerTool(
    'list_club_events',
    {
      description:
        'List upcoming public events for a specific club, sorted by start time. Includes capacity and current registered count.',
      inputSchema: listClubEventsInput,
    },
    wrap('list_club_events', listClubEvents) as never,
  );

  server.registerTool(
    'list_recent_events',
    {
      description:
        'List upcoming events across all non-inactive clubs, sorted by start time. Optional filter by club types.',
      inputSchema: listRecentEventsInput,
    },
    wrap('list_recent_events', listRecentEvents) as never,
  );

  server.registerTool(
    'list_club_posts',
    {
      description:
        'List recent published+public posts for a specific club. Optionally filter by post type (ANNOUNCEMENT or GENERAL). Pinned posts come first.',
      inputSchema: listClubPostsInput,
    },
    wrap('list_club_posts', listClubPosts) as never,
  );

  server.registerTool(
    'list_recent_announcements',
    {
      description:
        'List the most recent published+public ANNOUNCEMENT posts across all non-inactive clubs. Useful for surfacing what is currently happening.',
      inputSchema: listRecentAnnouncementsInput,
    },
    wrap('list_recent_announcements', listRecentAnnouncements) as never,
  );

  server.registerTool(
    'list_club_meetings',
    {
      description:
        'List the recurring weekly meeting schedule for a club (day-of-week, start/end time, location). Useful for matching against a student schedule.',
      inputSchema: listClubMeetingsInput,
    },
    wrap('list_club_meetings', listClubMeetings) as never,
  );

  logger.info('MCP server tools registered', {
    toolCount: 8,
  });
  return server;
}
