/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  useNavigate,
  useSearchParams,
  useParams,
  useLocation,
} from 'react-router-dom';
import { gql } from 'graphql-request';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import Editor from '@monaco-editor/react';
import { useDebounce } from 'use-debounce';
import {
  Space,
  Input,
  Button,
  Avatar,
  Empty,
  message as antdMessage,
  Spin,
  Modal,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  StopOutlined,
  ArrowLeftOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  FolderOutlined,
  DownOutlined,
  RightOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  MessageOutlined,
  LayoutOutlined,
  CodeOutlined,
  DesktopOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { AgentUIRenderer, AGENTS_WITH_UI_RENDERER } from './AgentUIRenderer';

import {
  activateScriptConfig,
  deactivateScriptConfig,
  getAllActiveScriptConfigs,
  runOrResumeScript,
  getScriptConfigPluginFiles,
  loadScriptVersionListsForAgent,
} from '../../api/scripts';
import { canonicalScriptCfgId } from './utils';

import {
  isAlphaEnabled,
  getRuntimeConfig,
} from '../../../../env/RuntimeConfig';
import { getAiIdeClient, getEngineClient } from '../../../../env/clients';
import { subscribe } from '@inngest/realtime';
import { InngestExecutionLogs } from './InngestExecutionLogs';
import { LogsTerminal } from './LogsTerminal';
import { getMonacoTheme, useResolvedTheme } from '../../../../theme';

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

export enum MessageType {
  RESULT = 'RESULT',
  ERROR = 'ERROR',
}

export enum ProjectType {
  PROVISIONING = 'PROVISIONING',
  NORMAL = 'NORMAL',
}

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  type: MessageType;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  chunks?: MessageChunk[];
}

export interface MessageChunk {
  id: string;
  response: string;
  createdAt: string;
  updatedAt: string;
  messageId: string;
}

export interface Project {
  id: string;
  name: string;
  scriptName: string;
  createdAt: string;
  updatedAt: string;
  projectType: ProjectType;
  isAIProject: boolean;
  isAwaitingScriptActivation?: boolean;
}

export interface AIScript {
  id: string;
  scriptConfigId: string;
  created: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
}

export interface File {
  id: string;
  name: string;
  content: string;
  path: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

interface FileNode {
  path: string;
  content: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

const GET_MESSAGES_QUERY = gql`
  query GetMessages($projectId: ID!) {
    aiIDEQueries {
      getMessages(projectId: $projectId) {
        id
        content
        role
        type
        createdAt
        updatedAt
        projectId
      }
    }
  }
`;

const GET_MESSAGE_CHUNKS_QUERY = gql`
  query GetMessageChunks($messageId: ID!) {
    aiIDEQueries {
      getMessageChunks(messageId: $messageId) {
        id
        response
        createdAt
        updatedAt
        messageId
      }
    }
  }
`;

const GET_FILES_QUERY = gql`
  query GetFiles($projectId: ID!) {
    aiIDEQueries {
      getFiles(projectId: $projectId) {
        id
        name
        content
        path
        projectId
        createdAt
        updatedAt
      }
    }
  }
`;

const GET_SCRIPTS_QUERY = gql`
  query GetScripts($projectId: ID!) {
    aiIDEQueries {
      getScripts(projectId: $projectId) {
        id
        scriptConfigId
        created
        createdBy
        createdAt
        updatedAt
        projectId
      }
    }
  }
`;

const GET_LATEST_SCRIPT_VERSION_QUERY = gql`
  query GetLatestScriptVersion($name: ScriptId!) {
    scriptProvisioning {
      availableScriptConfigVersions(name: $name, nextN: 1, cursor: "") {
        cursor
        count
        more
        results {
          id
          created
          createdBy
        }
      }
    }
  }
`;

const GET_PROJECT_QUERY = gql`
  query GetProject($projectId: ID!) {
    aiIDEQueries {
      getProject(projectId: $projectId) {
        id
        name
        scriptName
        createdAt
        updatedAt
        projectType
        isAIProject
        isAwaitingScriptActivation
      }
    }
  }
`;

const GET_AGENT_RUNS = gql`
  query GetAgentRuns($projectId: ID!) {
    aiIDEQueries {
      getAgentRuns(projectId: $projectId) {
        id
        runStatus
        createdAt
        updatedAt
      }
    }
  }
`;

const ENABLE_AI_PROJECT_MUTATION = gql`
  mutation EnableAIInProject($projectId: ID!) {
    aiIDEMutations {
      enableAIInProject(projectId: $projectId) {
        id
        isAIProject
      }
    }
  }
`;

const CREATE_MESSAGE_MUTATION = gql`
  mutation CreateMessage($projectId: ID!, $content: String!) {
    aiIDEMutations {
      createMessage(projectId: $projectId, content: $content) {
        id
        content
        role
        type
        createdAt
        updatedAt
        projectId
      }
    }
  }
`;

const UPDATE_FILES_MUTATION = gql`
  mutation UpdateFilesContent($input: UpdateFilesContentInput!) {
    aiIDEMutations {
      updateFilesContent(input: $input) {
        id
        name
        path
        content
        updatedAt
        projectId
        createdAt
      }
    }
  }
`;

const buildFileTree = (
  files: Array<{ path: string; content: string }>,
): FileNode[] => {
  const tree: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  files.forEach((file) => {
    const parts = file.path.split('/');
    let currentPath = '';

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const fullPath = currentPath ? `${currentPath}/${part}` : part;

      if (!pathMap.has(fullPath)) {
        const node: FileNode = {
          path: fullPath,
          content: isLast ? file.content : '',
          type: isLast ? 'file' : 'folder',
          children: [],
        };
        pathMap.set(fullPath, node);

        if (currentPath) {
          const parent = pathMap.get(currentPath);
          if (parent && parent.children) parent.children.push(node);
        } else {
          tree.push(node);
        }
      }

      currentPath = fullPath;
    });
  });

  return tree;
};

export default function CreateScriptPage() {
  const resolvedTheme = useResolvedTheme();
  const monacoTheme = getMonacoTheme(resolvedTheme);
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();

  const scriptIdParam = searchParams.get('id');
  const initialName = searchParams.get('name') || '';
  const initialPrompt = searchParams.get('prompt') || '';

  // Initial Data Load
  const initialDraft = useMemo(() => {
    if (!projectId) return null;
    try {
      const key = `overmind_ai_script_draft_${projectId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse draft', e);
    }
    return null;
  }, [projectId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [latestScript, setLatestScript] = useState<AIScript | null>(null);
  const [input, setInput] = useState(initialPrompt);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const [scriptName, setScriptName] = useState(initialName);
  const [generatedFiles, setGeneratedFiles] = useState<FileNode[]>(
    () => initialDraft?.generatedFiles || [],
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(
    () => initialDraft?.selectedFile || null,
  );
  const [editedFileContent, setEditedFileContent] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [createdScriptId, setCreatedScriptId] = useState<string | null>(
    scriptIdParam,
  );
  const [isLoadingScript] = useState(false);
  const [originalFiles, setOriginalFiles] = useState<Map<string, string>>(() =>
    initialDraft?.originalFiles
      ? new Map(initialDraft.originalFiles)
      : new Map(),
  );
  const [deletedPaths, setDeletedPaths] = useState<Set<string>>(() =>
    initialDraft?.deletedPaths ? new Set(initialDraft.deletedPaths) : new Set(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastLoadedConfigId, setLastLoadedConfigId] = useState<string | null>(
    () => initialDraft?.lastLoadedConfigId || null,
  );
  const [thinkingProgress, setThinkingProgress] = useState<string[]>([]);
  const [thinkingDuration, setThinkingDuration] = useState(0);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [messageChunks, setMessageChunks] = useState<
    Map<string, MessageChunk[]>
  >(new Map());
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const streamingMessageIdRef = useRef<string | null>(null);
  const isSubscribingRef = useRef(false);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    streamingMessageIdRef.current = streamingMessageId;
  }, [streamingMessageId]);

  const [thoughtProcessVisible, setThoughtProcessVisible] = useState<
    Map<string, boolean>
  >(new Map());
  const [isLogsTerminalVisible, setIsLogsTerminalVisible] = useState(false);
  const [isScriptActive, setIsScriptActive] = useState(false);
  const [activationPromptVisible, setActivationPromptVisible] = useState(false);
  const [isActiveModalOpen, setIsActiveModalOpen] = useState(false);
  const activationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  /** Read-only inspection of a historical script config version (same editor, snapshot files). */
  const [versionPreview, setVersionPreview] = useState<null | { cfgId: string; label: string }>(null);
  const filesSnapshotBeforePreviewRef = useRef<{
    tree: FileNode[];
    selected: string | null;
  } | null>(null);
  const [versionListsLoading, setVersionListsLoading] = useState(false);
  const [versionLists, setVersionLists] = useState<Awaited<
    ReturnType<typeof loadScriptVersionListsForAgent>
  > | null>(null);
  const [showArchivedVersions, setShowArchivedVersions] = useState(false);
  const [loadingVersionCfgId, setLoadingVersionCfgId] = useState<string | null>(null);

  const isAiRunning = sending || !!streamingMessageId;
  const effectiveScriptName = scriptName || project?.scriptName || '';

  const shouldShowLogsButton = useMemo(() => {
    if (isScriptActive) return true;
    if (project?.isAwaitingScriptActivation) return true;
    return messages.length > 2;
  }, [isScriptActive, project?.isAwaitingScriptActivation, messages.length]);

  useEffect(() => {
    const checkActiveState = async () => {
      if (!scriptName) return;
      try {
        const { rows } = await getAllActiveScriptConfigs();
        const isActive = rows.some((s) => s.name === scriptName);
        setIsScriptActive(isActive);
        if (isActive) {
          setIsLogsTerminalVisible(true);
        }
      } catch (e) {
        console.error('Failed to check script active state', e);
      }
    };
    checkActiveState();
  }, [scriptName]);

  useEffect(() => {
    if (!effectiveScriptName) {
      setVersionLists(null);
      return;
    }
    let cancelled = false;
    setVersionListsLoading(true);
    loadScriptVersionListsForAgent(effectiveScriptName)
      .then((data) => {
        if (!cancelled) setVersionLists(data);
      })
      .catch(() => {
        if (!cancelled) setVersionLists(null);
      })
      .finally(() => {
        if (!cancelled) setVersionListsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveScriptName]);

  // Layout state
  const [chatWidth, setChatWidth] = useState(25); // Percentage of total width
  const [filesWidth, setFilesWidth] = useState(20); // Percentage of coding area width
  const [executionLogsWidth, setExecutionLogsWidth] = useState(320); // Fixed width in pixels
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isFilesVisible, setIsFilesVisible] = useState(true);
  const [isExecutionLogsVisible, setIsExecutionLogsVisible] = useState(false);
  // Fullscreen states
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [isLogsFullscreen, setIsLogsFullscreen] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isDraggingExecutionLogs, setIsDraggingExecutionLogs] = useState(false);
  const [isRendererVisible, setIsRendererVisible] = useState(() =>
    AGENTS_WITH_UI_RENDERER.has(initialName),
  );
  const [isDraggingRenderer, setIsDraggingRenderer] = useState(false);
  const [rendererWidth, setRendererWidth] = useState(420);
  const containerRef = useRef<HTMLDivElement>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-open the renderer panel when scriptName resolves to a UI agent
  useEffect(() => {
    if (scriptName && AGENTS_WITH_UI_RENDERER.has(scriptName)) {
      setIsRendererVisible(true);
    }
  }, [scriptName]);
  // Resizing logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (isDraggingChat) {
        // Calculate new chat width from the right
        const newChatWidth =
          ((containerRect.right - e.clientX) / containerRect.width) * 100;
        // Constraints: Min 25%, Max 50%
        if (newChatWidth >= 25 && newChatWidth <= 50) {
          setChatWidth(newChatWidth);
        }
      }

      if (isDraggingFiles) {
        // Calculate files width relative to the coding area (left section)
        const codingAreaWidth = isChatVisible
          ? containerRect.width * ((100 - chatWidth) / 100)
          : containerRect.width;

        const newFilesWidth =
          ((e.clientX - containerRect.left) / codingAreaWidth) * 100;

        // Calculate min width in percentage of coding area to match 20% of screen width
        const minScreenWidthPercent = 20;
        const minFilesWidthPercent =
          (containerRect.width * minScreenWidthPercent) / codingAreaWidth;

        // Constraints: Min 20% of screen width, Max 50% of coding area
        // If < minFilesWidthPercent, hide files
        if (newFilesWidth < minFilesWidthPercent) {
          setIsFilesVisible(false);
          setIsDraggingFiles(false); // Stop dragging if hidden
        } else if (newFilesWidth <= 50) {
          setFilesWidth(newFilesWidth);
        }
      }

      if (isDraggingExecutionLogs) {
        // Calculate new execution logs width from the right edge
        const newWidth = containerRect.right - e.clientX;
        // Constraints: Min 250px, Max 800px
        if (newWidth >= 250 && newWidth <= 800) {
          setExecutionLogsWidth(newWidth);
        }
      }

      if (isDraggingRenderer) {
        // The renderer panel sits to the LEFT of the chat panel.
        // containerRect.right includes chat, so subtract chat's pixel width
        // to get the renderer panel's actual right edge.
        const chatPanelPx =
          isAlphaEnabled() && isChatVisible && !isChatFullscreen
            ? containerRect.width * (chatWidth / 100) + 1 // +1 for the 1px resizer
            : 0;
        const rendererRightEdge = containerRect.right - chatPanelPx;
        const newWidth = rendererRightEdge - e.clientX;
        // Constraints: Min 280px, Max 800px
        if (newWidth >= 280 && newWidth <= 800) {
          setRendererWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingChat(false);
      setIsDraggingFiles(false);
      setIsDraggingExecutionLogs(false);
      setIsDraggingRenderer(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (
      isDraggingChat ||
      isDraggingFiles ||
      isDraggingExecutionLogs ||
      isDraggingRenderer
    ) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [
    isDraggingChat,
    isDraggingFiles,
    isDraggingExecutionLogs,
    isDraggingRenderer,
    chatWidth,
    isChatVisible,
    isChatFullscreen,
  ]);

  // Modal states
  const [isCreateFileModalOpen, setIsCreateFileModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [targetParentPath, setTargetParentPath] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Refs for polling to access latest state without resetting interval
  const generatedFilesRef = useRef(generatedFiles);
  const originalFilesRef = useRef(originalFiles);
  const deletedPathsRef = useRef(deletedPaths);
  const lastLoadedConfigIdRef = useRef(lastLoadedConfigId);
  const selectedFileRef = useRef(selectedFile);

  useEffect(() => {
    generatedFilesRef.current = generatedFiles;
  }, [generatedFiles]);
  useEffect(() => {
    originalFilesRef.current = originalFiles;
  }, [originalFiles]);
  useEffect(() => {
    deletedPathsRef.current = deletedPaths;
  }, [deletedPaths]);
  useEffect(() => {
    lastLoadedConfigIdRef.current = lastLoadedConfigId;
  }, [lastLoadedConfigId]);
  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  const [debouncedGeneratedFiles] = useDebounce(generatedFiles, 1000);

  const hasChangesFn = (
    files: FileNode[],
    originals: Map<string, string>,
    deleted: Set<string>,
  ) => {
    if (deleted.size > 0) return true;

    const flattenFiles = (
      nodes: FileNode[],
    ): { path: string; content: string }[] => {
      let f: { path: string; content: string }[] = [];
      nodes.forEach((node) => {
        if (node.type === 'file') {
          f.push({ path: node.path, content: node.content });
        }
        if (node.children) {
          f = [...f, ...flattenFiles(node.children)];
        }
      });
      return f;
    };

    const currentFiles = flattenFiles(files);

    for (const file of currentFiles) {
      if (!originals.has(file.path)) return true;
      if (originals.get(file.path) !== file.content) return true;
    }

    return false;
  };

  // Local Storage Logic
  const getStorageKey = (id: string) => `overmind_ai_script_draft_${id}`;

  useEffect(() => {
    if (!projectId) return;
    const key = getStorageKey(projectId);

    const isChanged = hasChangesFn(
      debouncedGeneratedFiles,
      originalFiles,
      deletedPaths,
    );

    if (isChanged) {
      const data = {
        generatedFiles: debouncedGeneratedFiles,
        selectedFile: selectedFile,
        deletedPaths: Array.from(deletedPaths),
        originalFiles: Array.from(originalFiles.entries()),
        lastLoadedConfigId: lastLoadedConfigId,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.removeItem(key);
    }
  }, [
    debouncedGeneratedFiles,
    selectedFile,
    deletedPaths,
    projectId,
    lastLoadedConfigId,
    originalFiles,
  ]);

  // Before unload listener
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!projectId) return;

      const currentFiles = generatedFilesRef.current;
      const currentOriginals = originalFilesRef.current;
      const currentDeleted = deletedPathsRef.current;

      const isChanged = hasChangesFn(
        currentFiles,
        currentOriginals,
        currentDeleted,
      );

      if (isChanged) {
        const key = getStorageKey(projectId);
        const data = {
          generatedFiles: currentFiles,
          selectedFile: selectedFileRef.current,
          deletedPaths: Array.from(currentDeleted),
          originalFiles: Array.from(currentOriginals.entries()),
          lastLoadedConfigId: lastLoadedConfigIdRef.current,
          timestamp: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(data));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [projectId]);

  const showErrorToast = useCallback((msg: string) => {
    const first = (msg || 'Unexpected error').split('\n')[0];
    antdMessage.error(first);
  }, []);

  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = useCallback(
    (force = false) => {
      const el = listRef.current;
      if (el && (autoScroll || force)) {
        // Use scrollTop instead of scrollIntoView to avoid layout issues
        requestAnimationFrame(() => {
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        });
      }
    },
    [autoScroll],
  );

  useEffect(() => {
    // Only auto-scroll if user is at bottom (autoScroll is true)
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll, scrollToBottom, activationPromptVisible]);

  const subscribeToProject = useCallback(async () => {
    if (isSubscribingRef.current || isSubscribedRef.current) return;
    isSubscribingRef.current = true;
    try {
      console.log('Subscribing to project channel...');
      const { aiIdeAgentEndpoint } = getRuntimeConfig();
      const endpoint = aiIdeAgentEndpoint.endsWith('/')
        ? aiIdeAgentEndpoint
        : `${aiIdeAgentEndpoint}/`;
      const response = await fetch(`${endpoint}api/get-subscribe-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });
      if (response.ok) {
        const { token } = await response.json();
        console.log('Subscribing with token:', token);
        const { inngestBaseUrl } = getRuntimeConfig();
        let baseUrl = inngestBaseUrl;
        if (!baseUrl) {
          baseUrl = '';
        } else if (baseUrl.startsWith('/')) {
          baseUrl = window.location.origin;
        }
        // Pass apiBaseUrl to subscribe call so it uses the correct WebSocket endpoint
        const subscribeToken = {
          ...token,
          app: { apiBaseUrl: baseUrl },
        };
        const stream = await subscribe(subscribeToken);
        isSubscribedRef.current = true;
        // Handle stream async
        (async () => {
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const event = value;
              const data = event.data;

              console.log('Received event:', data);

              if (data?.type === 'user_message_created') {
                const realMsg = data.message;
                setMessages((prev) => {
                  const tempIndex = prev.findIndex(
                    (m) =>
                      m.id.startsWith('temp-') && m.role === MessageRole.USER,
                  );
                  if (tempIndex !== -1) {
                    const newMsgs = [...prev];
                    newMsgs[tempIndex] = realMsg;
                    return newMsgs;
                  }
                  if (!prev.some((m) => m.id === realMsg.id)) {
                    return [...prev, realMsg];
                  }
                  return prev;
                });
              } else if (data?.type === 'placeholder_agent_message_created') {
                const realMsg = data.message;
                setMessages((prev) => {
                  const tempIndex = prev.findIndex(
                    (m) =>
                      m.id.startsWith('temp-ai-') &&
                      m.role === MessageRole.ASSISTANT,
                  );
                  if (tempIndex !== -1) {
                    const newMsgs = [...prev];
                    newMsgs[tempIndex] = realMsg;
                    return newMsgs;
                  }
                  if (!prev.some((m) => m.id === realMsg.id)) {
                    return [...prev, realMsg];
                  }
                  return prev;
                });
                setStreamingMessageId(realMsg.id);
              } else if (data?.type === 'project_updated') {
                if (data.project) {
                  const updatedProject = { ...data.project };
                  // Handle potential snake_case from raw events
                  if ('is_awaiting_script_activation' in updatedProject) {
                    updatedProject.isAwaitingScriptActivation =
                      updatedProject.is_awaiting_script_activation;
                  }
                  setProject((prev) =>
                    prev ? { ...prev, ...updatedProject } : null,
                  );
                  if (data.project.scriptName)
                    setScriptName(data.project.scriptName);
                }
              } else if (data?.type === 'script_created') {
                if (data.script) {
                  setLatestScript(data.script);
                }
              } else if (data?.type === 'files_updated') {
                if (data.files) {
                  const newFiles = Object.entries(data.files).map(
                    ([path, content]) => ({ path, content: content as string }),
                  );
                  const newFilesMap = new Map(originalFilesRef.current);
                  newFiles.forEach((f) => newFilesMap.set(f.path, f.content));
                  setOriginalFiles(newFilesMap);
                  setGeneratedFiles(
                    buildFileTree(
                      Array.from(newFilesMap.entries()).map(
                        ([path, content]) => ({
                          path,
                          content: content as string,
                        }),
                      ),
                    ),
                  );
                }
              } else if (data?.type === 'agent_message_closed') {
                const realMsg = data.message;
                setMessages((prev) => {
                  const idx = prev.findIndex((m) => m.id === realMsg.id);
                  if (idx !== -1) {
                    const newMsgs = [...prev];
                    newMsgs[idx] = realMsg;
                    return newMsgs;
                  }
                  const tempIdx = prev.findIndex(
                    (m) =>
                      m.id.startsWith('temp-ai-') &&
                      m.role === MessageRole.ASSISTANT,
                  );
                  if (tempIdx !== -1) {
                    const newMsgs = [...prev];
                    newMsgs[tempIdx] = realMsg;
                    return newMsgs;
                  }
                  return [...prev, realMsg];
                });
                setStreamingMessageId(null);

                // Rehydration: Refresh all messages and project state to ensure consistency
                try {
                  const [
                    msgsData,
                    projectData,
                    scriptsData,
                    filesData,
                    runsData,
                  ]: [any, any, any, any, any] = await Promise.all([
                    getAiIdeClient().request(GET_MESSAGES_QUERY, { projectId }),
                    getAiIdeClient().request(GET_PROJECT_QUERY, { projectId }),
                    getAiIdeClient().request(GET_SCRIPTS_QUERY, { projectId }),
                    getAiIdeClient().request(GET_FILES_QUERY, { projectId }),
                    getAiIdeClient().request(GET_AGENT_RUNS, { projectId }),
                  ]);

                  // Update runs
                  const runs = runsData?.aiIDEQueries?.getAgentRuns || [];
                  runs.sort(
                    (a: any, b: any) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  );
                  if (runs.length > 0) {
                    setActiveRunId(runs[0].id);
                  }

                  // Update messages
                  const msgs = msgsData.aiIDEQueries.getMessages;
                  msgs.sort(
                    (a: Message, b: Message) =>
                      new Date(a.createdAt).getTime() -
                      new Date(b.createdAt).getTime(),
                  );
                  setMessages(msgs);

                  // Update project
                  setProject(projectData.aiIDEQueries.getProject);
                  if (projectData.aiIDEQueries.getProject.scriptName) {
                    setScriptName(
                      projectData.aiIDEQueries.getProject.scriptName,
                    );
                  }

                  // Update scripts
                  const scripts = scriptsData.aiIDEQueries.getScripts;
                  if (scripts && scripts.length > 0) {
                    scripts.sort(
                      (a: AIScript, b: AIScript) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    );
                    setLatestScript(scripts[0]);
                  }

                  // Update files (only if no local changes)
                  const files = filesData.aiIDEQueries.getFiles;
                  if (files && deletedPathsRef.current.size === 0) {
                    // Check for local modifications... (simplified check here for brevity, assuming safer to refetch)
                    // Since we just finished an AI run, we should probably take the server state unless the user was editing concurrently
                    // But let's follow the existing logic or just update
                    // For now, let's update files map
                    setGeneratedFiles(buildFileTree(files));
                    const fileMap = new Map<string, string>();
                    files.forEach((f: any) => fileMap.set(f.path, f.content));
                    setOriginalFiles(fileMap);
                  }
                } catch (e) {
                  console.error(
                    'Error rehydrating after agent message closed',
                    e,
                  );
                }

                // Break the loop to kill subscription
                break;
              } else if (!data?.type && data?.response) {
                setThinkingProgress((prev) => [...prev, data.response]);
              } else if (data?.type === 'awaiting_user_activation') {
                setActivationPromptVisible(true);
                // Also update project state if needed so useEffect doesn't conflict
                setProject((prev) =>
                  prev ? { ...prev, isAwaitingScriptActivation: true } : null,
                );

                // Fetch latest run ID to ensure we have it for the activation request
                try {
                  const runsData: any = await getAiIdeClient().request(
                    GET_AGENT_RUNS,
                    { projectId },
                  );
                  const runs = runsData?.aiIDEQueries?.getAgentRuns || [];
                  runs.sort(
                    (a: any, b: any) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  );
                  if (runs.length > 0) {
                    setActiveRunId(runs[0].id);
                  }
                } catch (e) {
                  console.error(
                    'Failed to refresh runs on activation request',
                    e,
                  );
                }
              } else if (
                data?.type === 'user_activation_response_received_true'
              ) {
                if (activationIntervalRef.current) {
                  clearInterval(activationIntervalRef.current);
                  activationIntervalRef.current = null;
                }
                setActivationPromptVisible(false);
                // Agent confirmed activation, now show logs and enable polling
                setIsLogsTerminalVisible(true);
                setIsScriptActive(true);
              } else if (
                data?.type === 'user_activation_response_timeout' ||
                data?.type === 'user_activation_response_received_false'
              ) {
                if (activationIntervalRef.current) {
                  clearInterval(activationIntervalRef.current);
                  activationIntervalRef.current = null;
                }
                setActivationPromptVisible(false);
                if (data?.type === 'user_activation_response_timeout') {
                  antdMessage.error('Activation request timed out');
                }
              }
            }
          } catch (e) {
            console.error('Error reading stream', e);
          } finally {
            reader.releaseLock();
            isSubscribedRef.current = false;
            // Refresh messages at end to ensure we have latest state
            try {
              const data: any = await getAiIdeClient().request(
                GET_MESSAGES_QUERY,
                {
                  projectId,
                },
              );
              const msgs = data.aiIDEQueries.getMessages;
              msgs.sort(
                (a: Message, b: Message) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime(),
              );
              setMessages(msgs);
            } catch (e) {
              console.error('Error refreshing messages', e);
            }
          }
        })();
      }
    } catch (err) {
      console.error('Failed to subscribe to project', err);
    } finally {
      isSubscribingRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const fetchMessages = async () => {
      try {
        const data: any = await getAiIdeClient().request(GET_MESSAGES_QUERY, {
          projectId,
        });
        const msgs = data.aiIDEQueries.getMessages;
        // Sort by createdAt
        msgs.sort(
          (a: Message, b: Message) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setMessages(msgs);

        // Check for empty assistant message at the end
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg.role === MessageRole.ASSISTANT && !lastMsg.content) {
            // Resume streaming
            if (streamingMessageIdRef.current !== lastMsg.id) {
              setStreamingMessageId(lastMsg.id);
              // Fetch existing chunks
              const chunksData: any = await getAiIdeClient().request(
                GET_MESSAGE_CHUNKS_QUERY,
                { messageId: lastMsg.id },
              );
              const chunks = chunksData.aiIDEQueries.getMessageChunks;

              // Sort chunks by createdAt
              chunks.sort(
                (a: any, b: any) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime(),
              );

              // Populate thinkingProgress with existing chunks
              setThinkingProgress(chunks.map((c: any) => c.response));

              // Calculate initial duration from chunks
              if (chunks.length > 0) {
                const start = new Date(chunks[0].createdAt).getTime();
                const end = new Date(
                  chunks[chunks.length - 1].createdAt,
                ).getTime();
                setThinkingDuration((end - start) / 1000);
              } else {
                setThinkingDuration(0);
              }

              // Subscribe
              subscribeToProject();
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch messages', error);
        antdMessage.error('Failed to load chat history');
      }
    };

    const fetchProjectAndScripts = async () => {
      try {
        const [projectData, scriptsData, filesData, runsData]: [
          any,
          any,
          any,
          any,
        ] = await Promise.all([
          getAiIdeClient().request(GET_PROJECT_QUERY, { projectId }),
          getAiIdeClient().request(GET_SCRIPTS_QUERY, { projectId }),
          getAiIdeClient().request(GET_FILES_QUERY, { projectId }),
          getAiIdeClient().request(GET_AGENT_RUNS, { projectId }),
        ]);

        const runs = runsData?.aiIDEQueries?.getAgentRuns || [];
        // Sort runs by createdAt descending (newest first)
        runs.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        if (runs.length > 0) {
          setActiveRunId(runs[0].id);
        }

        setProject(projectData.aiIDEQueries.getProject);
        if (projectData.aiIDEQueries.getProject.scriptName) {
          setScriptName(projectData.aiIDEQueries.getProject.scriptName);
        }

        const scripts = scriptsData.aiIDEQueries.getScripts;
        let currentScript: AIScript | null = null;
        if (scripts && scripts.length > 0) {
          // Sort by createdAt descending to get the latest
          scripts.sort(
            (a: AIScript, b: AIScript) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          currentScript = scripts[0];
          setLatestScript(currentScript);
        }

        const files = filesData.aiIDEQueries.getFiles;
        if (files) {
          const newConfigId = currentScript?.scriptConfigId;
          const lastConfigId = lastLoadedConfigIdRef.current;

          // Check if we have local changes
          const hasLocalChanges = () => {
            if (deletedPathsRef.current.size > 0) return true;

            const flattenFiles = (
              nodes: FileNode[],
            ): { path: string; content: string }[] => {
              let files: { path: string; content: string }[] = [];
              nodes.forEach((node) => {
                if (node.type === 'file') {
                  files.push({ path: node.path, content: node.content });
                }
                if (node.children) {
                  files = [...files, ...flattenFiles(node.children)];
                }
              });
              return files;
            };

            const currentFiles = flattenFiles(generatedFilesRef.current);
            const originals = originalFilesRef.current;

            for (const file of currentFiles) {
              if (!originals.has(file.path)) return true;
              if (originals.get(file.path) !== file.content) return true;
            }
            return false;
          };

          // Update if:
          // 1. We haven't loaded anything yet (lastConfigId is null)
          // 2. The script config ID has changed (new version from AI)
          // 3. We don't have any local changes (safe to sync)
          if (
            !lastConfigId ||
            (newConfigId && newConfigId !== lastConfigId) ||
            !hasLocalChanges()
          ) {
            setGeneratedFiles(buildFileTree(files));
            const fileMap = new Map<string, string>();
            files.forEach((f: any) => fileMap.set(f.path, f.content));
            setOriginalFiles(fileMap);
            setDeletedPaths(new Set());
            if (newConfigId) {
              setLastLoadedConfigId(newConfigId);
            }
          }
        }
        return projectData.aiIDEQueries.getProject;
      } catch (error) {
        console.error('Failed to fetch project or agents', error);
        return null;
      }
    };

    fetchProjectAndScripts().then((proj) => {
      if (isAlphaEnabled() && proj?.isAIProject) {
        fetchMessages();
      }
    });
  }, [projectId, subscribeToProject]);

  const handleChatScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 32;
    setAutoScroll(atBottom);
  }, []);

  useEffect(() => {
    if (project?.isAwaitingScriptActivation) {
      setTimeout(() => setActivationPromptVisible(true), 2000);
    } else {
      setActivationPromptVisible(false);
    }
  }, [project?.isAwaitingScriptActivation]);

  useEffect(() => {
    if (latestScript && latestScript.id !== createdScriptId) {
      setCreatedScriptId(latestScript.id);
    }
  }, [latestScript, createdScriptId]);

  useEffect(() => {
    if (location.state?.initialPrompt) {
      // Clear the state so we don't subscribe again on refresh/navigation
      window.history.replaceState({}, document.title);
      subscribeToProject();
    }
  }, [location.state, subscribeToProject]);

  const toggleThoughtProcess = async (messageId: string) => {
    const isVisible = thoughtProcessVisible.get(messageId);

    if (isVisible) {
      setThoughtProcessVisible((prev) => new Map(prev).set(messageId, false));
      return;
    }

    // If we are showing it, check if we need to fetch
    if (!messageChunks.has(messageId)) {
      try {
        const data: any = await getAiIdeClient().request(
          GET_MESSAGE_CHUNKS_QUERY,
          { messageId },
        );
        const chunks = data.aiIDEQueries.getMessageChunks;
        setMessageChunks((prev) => new Map(prev).set(messageId, chunks));
      } catch (e) {
        console.error('Failed to fetch chunks', e);
        return;
      }
    }

    setThoughtProcessVisible((prev) => new Map(prev).set(messageId, true));
  };

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !projectId) return;
    setInput('');
    setSending(true);
    setThinkingProgress([]);
    setThinkingDuration(0);
    setIsThinkingExpanded(false);

    try {
      // Optimistically add user message
      const tempId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: tempId,
        content: text,
        role: MessageRole.USER,
        type: MessageType.RESULT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: projectId,
      };

      // Optimistically add placeholder AI message
      const tempAiId = `temp-ai-${Date.now()}`;
      const tempAiMessage: Message = {
        id: tempAiId,
        content: '',
        role: MessageRole.ASSISTANT,
        type: MessageType.RESULT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: projectId,
      };

      setMessages((prev) => [...prev, tempMessage, tempAiMessage]);
      setStreamingMessageId(tempAiId);

      // Start listening to project channel immediately
      await subscribeToProject();

      await getAiIdeClient().request(CREATE_MESSAGE_MUTATION, {
        projectId,
        content: text,
      });
    } catch (error: any) {
      console.error('Failed to send message', error);
      antdMessage.error(error?.message || 'Failed to send message');
      // Remove optimistic messages on error
      setMessages((prev) =>
        prev.filter((m) => m.content !== text && !m.id.startsWith('temp-ai-')),
      );
    } finally {
      setSending(false);
    }
  }, [input, projectId, subscribeToProject]);

  const onStop = useCallback(() => {
    // TODO: Implement stop logic
    console.log('Stop chat');
  }, []);

  const handleActivationResponse = async (choice: boolean) => {
    const sendRequest = async () => {
      if (!projectId) return;
      try {
        const { aiIdeAgentEndpoint } = getRuntimeConfig();
        const endpoint = aiIdeAgentEndpoint.endsWith('/')
          ? aiIdeAgentEndpoint
          : `${aiIdeAgentEndpoint}/`;

        await fetch(`${endpoint}api/agents/activation-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            choice,
            projectId,
            agentRunID: activeRunId,
          }),
        });
      } catch (e) {
        console.error('Activation request failed', e);
      }
    };

    if (choice) {
      // Optimistically start sending requests
      // UI updates (logs terminal, script active check) will happen when confirmed via subscription
      await sendRequest();

      if (activationIntervalRef.current)
        clearInterval(activationIntervalRef.current);
      activationIntervalRef.current = setInterval(sendRequest, 5000);
    } else {
      await sendRequest();
      setActivationPromptVisible(false);
    }
  };

  const handleActivateScript = async () => {
    if (isScriptActive) {
      if (!scriptName) return;
      try {
        await deactivateScriptConfig(scriptName);
        antdMessage.success('Script deactivated');
        setIsScriptActive(false);
        setIsLogsTerminalVisible(false);
      } catch (e: any) {
        showErrorToast(e?.message || 'Failed to deactivate');
      }
    } else {
      if (!latestScript?.scriptConfigId) {
        antdMessage.warning('No agent configuration available to activate');
        return;
      }

      try {
        await activateScriptConfig(latestScript.scriptConfigId);
        antdMessage.success('Agent activated successfully!');
        setIsLogsTerminalVisible(true);
        setIsScriptActive(true);

        setIsActiveModalOpen(true);
        setTimeout(() => setIsActiveModalOpen(false), 3000);
      } catch (error: any) {
        const msg = error?.message || 'Failed to activate agent';
        showErrorToast(msg);
      }
    }
  };

  const closeVersionPreview = useCallback(() => {
    const snap = filesSnapshotBeforePreviewRef.current;
    if (snap) {
      setGeneratedFiles(snap.tree);
      setSelectedFile(snap.selected);
      filesSnapshotBeforePreviewRef.current = null;
    }
    setVersionPreview(null);
    setLoadingVersionCfgId(null);
  }, []);

  const openVersionPreview = useCallback(
    async (cfgId: string, versionLabel: string) => {
      if (!effectiveScriptName) return;
      if (!filesSnapshotBeforePreviewRef.current) {
        filesSnapshotBeforePreviewRef.current = {
          tree: generatedFilesRef.current,
          selected: selectedFileRef.current,
        };
      }
      setLoadingVersionCfgId(cfgId);
      try {
        const files = await getScriptConfigPluginFiles(cfgId);
        const tree = buildFileTree(files);
        setGeneratedFiles(tree);
        const firstPath = files[0]?.path ?? null;
        setSelectedFile(firstPath);
        setVersionPreview({
          cfgId,
          label: versionLabel.trim() || 'Untitled version',
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load this version';
        antdMessage.error(msg);
        filesSnapshotBeforePreviewRef.current = null;
        setVersionPreview(null);
      } finally {
        setLoadingVersionCfgId(null);
      }
    },
    [effectiveScriptName],
  );

  const handleActivatePreviewVersion = useCallback(async () => {
    if (!versionPreview || !effectiveScriptName) return;
    try {
      const meta = await activateScriptConfig(versionPreview.cfgId as any);
      const canonicalId = canonicalScriptCfgId(meta.id, effectiveScriptName);
      setLatestScript((prev) => {
        if (prev) {
          return { ...prev, scriptConfigId: canonicalId };
        }
        return {
          id: canonicalId,
          scriptConfigId: canonicalId,
          created: new Date().toISOString(),
          createdBy: meta.description || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          projectId: projectId || '',
        };
      });

      antdMessage.success('Version activated');
      const vl = await loadScriptVersionListsForAgent(effectiveScriptName);
      setVersionLists(vl);

      try {
        const { rows } = await getAllActiveScriptConfigs();
        setIsScriptActive(rows.some((s) => String(s.name) === effectiveScriptName));
      } catch {
        setIsScriptActive(true);
      }

      filesSnapshotBeforePreviewRef.current = null;
      setVersionPreview(null);
      setLoadingVersionCfgId(null);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Activation failed — stop the running script if switching versions.';
      antdMessage.error(msg);
    }
  }, [versionPreview, effectiveScriptName, projectId]);

  useEffect(() => {
    if (!versionPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeVersionPreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [versionPreview, closeVersionPreview]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFile === node.path;

      if (node.type === 'folder') {
        return (
          <div key={node.path}>
            <div
              className={`group flex items-center gap-2 py-1 text-xs hover:bg-om-elevated ${
                isSelected ? 'bg-om-elevated' : 'text-gray-400'
              }`}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
              <div
                className='flex flex-1 cursor-pointer items-center gap-2'
                onClick={() => toggleFolder(node.path)}
              >
                {isExpanded ? (
                  <DownOutlined
                    className='text-xs text-gray-400'
                    style={{ fontSize: '12px' }}
                  />
                ) : (
                  <RightOutlined
                    className='text-xs text-gray-400'
                    style={{ fontSize: '12px' }}
                  />
                )}
                <FolderOutlined
                  className='text-gray-400'
                  style={{ fontSize: '12px' }}
                />
                <span className='text-gray-300'>
                  {node.path.split('/').pop()}
                </span>
              </div>
              {!versionPreview && (
                <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                  <Button
                    type='text'
                    size='small'
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      addFile(node.path);
                    }}
                    className='text-xs text-gray-500 hover:text-blue-400'
                    title='Add File'
                  />
                  <Button
                    type='text'
                    size='small'
                    icon={<FolderOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      addFolder(node.path);
                    }}
                    className='text-xs text-gray-500 hover:text-blue-400'
                    title='Add Folder'
                  />
                  <Button
                    type='text'
                    size='small'
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFileOrFolder(node.path);
                    }}
                    className='text-xs text-gray-500 hover:text-red-400'
                    title='Delete'
                  />
                </div>
              )}
            </div>
            {isExpanded && node.children && (
              <div>{renderFileTree(node.children, level + 1)}</div>
            )}
          </div>
        );
      }

      return (
        <div
          key={node.path}
          className={`group flex items-center gap-2 py-1 text-xs hover:bg-om-elevated ${
            isSelected ? 'bg-om-elevated text-white' : 'text-gray-500'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <div
            className='flex flex-1 cursor-pointer items-center gap-2'
            onClick={() => setSelectedFile(node.path)}
          >
            <FileTextOutlined
              className={isSelected ? 'text-blue-400' : 'text-gray-500'}
              style={{ fontSize: '12px' }}
            />
            <span>{node.path.split('/').pop()}</span>
          </div>
          {!versionPreview && (
            <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
              <Button
                type='text'
                size='small'
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFileOrFolder(node.path);
                }}
                className='text-xs text-gray-500 hover:text-red-400'
                title='Delete'
              />
            </div>
          )}
        </div>
      );
    });
  };

  const getSelectedFileContent = (): string => {
    if (!selectedFile) return '';

    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === selectedFile) return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const file = findFile(generatedFiles);
    return file?.content || '';
  };

  // Update edited content when file selection changes
  useEffect(() => {
    if (selectedFile) {
      // Only update if the content is actually different to avoid cursor jumping
      const newContent = getSelectedFileContent();
      if (newContent !== editedFileContent) {
        setEditedFileContent(newContent);
      }
    } else {
      setEditedFileContent('');
    }
  }, [selectedFile, generatedFiles]);

  const updateFileContent = (path: string, newContent: string) => {
    if (versionPreview) return;
    setGeneratedFiles((prevFiles) => {
      const updateNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === path && node.type === 'file') {
            return { ...node, content: newContent };
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };
      return updateNode(prevFiles);
    });
  };

  const addFile = (parentPath: string = '') => {
    if (versionPreview) {
      antdMessage.warning('Close version preview to add files.');
      return;
    }
    setTargetParentPath(parentPath);
    setNewItemName('');
    setIsCreateFileModalOpen(true);
  };

  const handleCreateFile = () => {
    const fileName = newItemName.trim();
    if (!fileName) return;

    const newPath = targetParentPath
      ? `${targetParentPath}/${fileName}`
      : fileName;

    // Check if file already exists
    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === newPath) return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    if (findFile(generatedFiles)) {
      antdMessage.warning('File already exists');
      return;
    }

    const newFile: FileNode = {
      path: newPath,
      content: '',
      type: 'file',
      children: [],
    };

    if (!targetParentPath) {
      setGeneratedFiles((prev) => [...prev, newFile]);
    } else {
      setGeneratedFiles((prev) => {
        const addToParent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.path === targetParentPath && node.type === 'folder') {
              return {
                ...node,
                children: [...(node.children || []), newFile],
              };
            }
            if (node.children) {
              return { ...node, children: addToParent(node.children) };
            }
            return node;
          });
        };
        return addToParent(prev);
      });
      setExpandedFolders((prev) => new Set(prev).add(targetParentPath));
    }

    setSelectedFile(newPath);
    setEditedFileContent('');
    setIsCreateFileModalOpen(false);
  };

  const addFolder = (parentPath: string = '') => {
    if (versionPreview) {
      antdMessage.warning('Close version preview to add folders.');
      return;
    }
    setTargetParentPath(parentPath);
    setNewItemName('');
    setIsCreateFolderModalOpen(true);
  };

  const handleCreateFolder = () => {
    const folderName = newItemName.trim();
    if (!folderName) return;

    const newPath = targetParentPath
      ? `${targetParentPath}/${folderName}`
      : folderName;

    // Check if folder already exists
    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === newPath) return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    if (findFile(generatedFiles)) {
      antdMessage.warning('Folder already exists');
      return;
    }

    const newFolder: FileNode = {
      path: newPath,
      content: '',
      type: 'folder',
      children: [],
    };

    if (!targetParentPath) {
      setGeneratedFiles((prev) => [...prev, newFolder]);
    } else {
      setGeneratedFiles((prev) => {
        const addToParent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.path === targetParentPath && node.type === 'folder') {
              return {
                ...node,
                children: [...(node.children || []), newFolder],
              };
            }
            if (node.children) {
              return { ...node, children: addToParent(node.children) };
            }
            return node;
          });
        };
        return addToParent(prev);
      });
      setExpandedFolders((prev) => new Set(prev).add(targetParentPath));
    }

    setExpandedFolders((prev) => new Set(prev).add(newPath));
    setIsCreateFolderModalOpen(false);
  };

  const deleteFileOrFolder = (path: string) => {
    if (versionPreview) return;
    setItemToDelete(path);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (!itemToDelete) return;
    const path = itemToDelete;

    // Recursively find all files in the deleted path to add to deletedPaths
    const findFilesToDelete = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.path.startsWith(path)) {
          if (node.type === 'file' && originalFiles.has(node.path)) {
            setDeletedPaths((prev) => new Set(prev).add(node.path));
          }
          if (node.children) {
            findFilesToDelete(node.children);
          }
        }
      });
    };
    findFilesToDelete(generatedFiles);

    const removeNode = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .filter((node) => node.path !== path)
        .map((node) => {
          if (node.children) {
            return { ...node, children: removeNode(node.children) };
          }
          return node;
        });
    };

    setGeneratedFiles((prev) => removeNode(prev));
    if (selectedFile === path || selectedFile?.startsWith(path + '/')) {
      setSelectedFile(null);
      setEditedFileContent('');
    }
    setIsDeleteModalOpen(false);
  };

  const hasChanges = () => {
    if (versionPreview) return false;
    if (deletedPaths.size > 0) return true;

    const flattenFiles = (
      nodes: FileNode[],
    ): { path: string; content: string }[] => {
      let files: { path: string; content: string }[] = [];
      nodes.forEach((node) => {
        if (node.type === 'file') {
          files.push({ path: node.path, content: node.content });
        }
        if (node.children) {
          files = [...files, ...flattenFiles(node.children)];
        }
      });
      return files;
    };

    const currentFiles = flattenFiles(generatedFiles);

    // Check for new or modified files
    for (const file of currentFiles) {
      if (!originalFiles.has(file.path)) return true; // New file
      if (originalFiles.get(file.path) !== file.content) return true; // Modified file
    }

    // Check if any original file is missing (and not in deletedPaths - though that should be covered)
    // Actually, if it's missing from currentFiles, it should be in deletedPaths if we tracked it correctly.
    // But let's be safe.

    return false;
  };

  const handleSaveFiles = async () => {
    if (versionPreview) {
      antdMessage.warning('Close version preview to save project files.');
      return;
    }
    if (!projectId) return;
    setIsSaving(true);

    try {
      const flattenFiles = (
        nodes: FileNode[],
      ): { path: string; content: string }[] => {
        let files: { path: string; content: string }[] = [];
        nodes.forEach((node) => {
          if (node.type === 'file') {
            files.push({ path: node.path, content: node.content });
          }
          if (node.children) {
            files = [...files, ...flattenFiles(node.children)];
          }
        });
        return files;
      };

      const currentFiles = flattenFiles(generatedFiles);
      const filesToUpdate = currentFiles.filter((file) => {
        // Include if new or modified
        return (
          !originalFiles.has(file.path) ||
          originalFiles.get(file.path) !== file.content
        );
      });

      const input = {
        projectId,
        files: filesToUpdate.map((f) => ({ path: f.path, content: f.content })),
        deleteFiles: Array.from(deletedPaths),
      };

      const data: any = await getAiIdeClient().request(UPDATE_FILES_MUTATION, {
        input,
      });
      const files = data.aiIDEMutations.updateFilesContent;

      antdMessage.success('Files saved successfully');

      // Refetch to sync state
      if (scriptName) {
        try {
          const scriptData: any = await getEngineClient().request(
            GET_LATEST_SCRIPT_VERSION_QUERY,
            { name: scriptName },
          );
          const results =
            scriptData?.scriptProvisioning?.availableScriptConfigVersions
              ?.results;
          if (results && results.length > 0) {
            const latest = results[0];
            setLatestScript({
              id: latest.id,
              scriptConfigId: latest.id,
              created: latest.created,
              createdBy: latest.createdBy,
              createdAt: new Date().toISOString(), // this is because this data (same can be said about id and updatedAt) cant be accessed from this query. This data is not used in frontend so it is okay here for now. I think we should get data from both ai ide and the overmind gql later on.
              updatedAt: new Date().toISOString(),
              projectId: projectId,
            });
          }
        } catch (e) {
          console.error('Failed to fetch latest script after save', e);
        }
      }

      // Update local state
      if (files) {
        setGeneratedFiles(buildFileTree(files));
        const fileMap = new Map<string, string>();
        files.forEach((f: any) => fileMap.set(f.path, f.content));
        setOriginalFiles(fileMap);
        setDeletedPaths(new Set());
      }
    } catch (error: any) {
      console.error('Failed to save files', error);
      showErrorToast(error?.message || 'Failed to save files');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnableAI = async () => {
    if (!projectId) return;
    try {
      await getAiIdeClient().request(ENABLE_AI_PROJECT_MUTATION, { projectId });
      antdMessage.success('AI enabled for this project');
      // Refetch project to update state
      const projectData: any = await getAiIdeClient().request(
        GET_PROJECT_QUERY,
        { projectId },
      );
      setProject(projectData.aiIDEQueries.getProject);
    } catch (error: any) {
      console.error('Failed to enable AI', error);
      showErrorToast(error?.message || 'Failed to enable AI');
    }
  };

  if (isLoadingScript) {
    return (
      <div className='flex h-full items-center justify-center bg-om-page'>
        <Spin size='large' />
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col overflow-hidden bg-om-page'>
      <div className='flex h-14 shrink-0 items-center justify-between border-b border-om-border bg-om-panel px-6'>
        <div className='flex items-center gap-4'>
          <Button
            type='text'
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/config?tab=scripts')}
            className='text-gray-400 hover:text-white'
          />
          <div className='group relative flex flex-col justify-center'>
            <div className='flex items-center gap-3'>
              <h2 className='text-lg font-bold leading-none text-white'>
                {project?.scriptName || scriptName || 'Create New Agent'}
              </h2>
              {project?.projectType && (
                <span className='rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400'>
                  {project.projectType}
                </span>
              )}
            </div>
            {project?.updatedAt && (
              <div className='absolute left-0 top-full z-10 cursor-default whitespace-nowrap pt-1 text-[10px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100'>
                Last updated: {new Date(project.updatedAt).toLocaleString()}
              </div>
            )}
          </div>

          <div className='mx-2 h-6 w-px bg-om-elevated' />
          <div className='flex items-center gap-1'>
            <Button
              type={isFilesVisible ? 'primary' : 'text'}
              size='small'
              icon={<LayoutOutlined />}
              onClick={() => setIsFilesVisible(!isFilesVisible)}
              className={
                isFilesVisible
                  ? 'border-none bg-om-elevated text-white'
                  : 'text-gray-400 hover:text-white'
              }
              title={isFilesVisible ? 'Hide Files' : 'Show Files'}
            />
            {AGENTS_WITH_UI_RENDERER.has(scriptName || '') && (
              <Button
                type={isRendererVisible ? 'primary' : 'text'}
                size='small'
                icon={<DesktopOutlined />}
                onClick={() => setIsRendererVisible((v) => !v)}
                className={
                  isRendererVisible
                    ? 'border-none bg-emerald-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }
                title={
                  isRendererVisible ? 'Hide UI Preview' : 'Show Live UI Preview'
                }
              />
            )}
            {isAlphaEnabled() && (
              <>
                <Button
                  type={isChatVisible ? 'primary' : 'text'}
                  size='small'
                  icon={<MessageOutlined />}
                  onClick={() => {
                    if (clickTimeoutRef.current)
                      clearTimeout(clickTimeoutRef.current);
                    clickTimeoutRef.current = setTimeout(() => {
                      if (!isChatVisible) {
                        setIsChatVisible(true);
                        setIsChatFullscreen(false);
                        if (isLogsFullscreen) setIsLogsFullscreen(false);
                      } else if (!isChatFullscreen) {
                        setIsChatFullscreen(true);
                        if (isLogsFullscreen) setIsLogsFullscreen(false);
                      } else {
                        setIsChatVisible(false);
                        setIsChatFullscreen(false);
                      }
                    }, 200);
                  }}
                  onDoubleClick={() => {
                    if (clickTimeoutRef.current)
                      clearTimeout(clickTimeoutRef.current);
                    if (isChatVisible) {
                      setIsChatVisible(false);
                      setIsChatFullscreen(false);
                    } else {
                      setIsChatVisible(true);
                      setIsChatFullscreen(true);
                      if (isLogsFullscreen) setIsLogsFullscreen(false);
                    }
                  }}
                  className={
                    isChatVisible
                      ? 'border-none bg-om-elevated text-white'
                      : 'text-gray-400 hover:text-white'
                  }
                  title={
                    !isChatVisible
                      ? 'Show Chat'
                      : isChatFullscreen
                        ? 'Minimize Chat'
                        : 'Expand Chat'
                  }
                />
                <Button
                  type={isExecutionLogsVisible ? 'primary' : 'text'}
                  size='small'
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    if (clickTimeoutRef.current)
                      clearTimeout(clickTimeoutRef.current);
                    clickTimeoutRef.current = setTimeout(() => {
                      if (!isExecutionLogsVisible) {
                        setIsExecutionLogsVisible(true);
                        setIsLogsFullscreen(false);
                        if (isChatFullscreen) setIsChatFullscreen(false);
                      } else if (!isLogsFullscreen) {
                        setIsLogsFullscreen(true);
                        if (isChatFullscreen) setIsChatFullscreen(false);
                      } else {
                        setIsExecutionLogsVisible(false);
                        setIsLogsFullscreen(false);
                      }
                    }, 200);
                  }}
                  onDoubleClick={() => {
                    if (clickTimeoutRef.current)
                      clearTimeout(clickTimeoutRef.current);
                    if (isExecutionLogsVisible) {
                      setIsExecutionLogsVisible(false);
                      setIsLogsFullscreen(false);
                    } else {
                      setIsExecutionLogsVisible(true);
                      setIsLogsFullscreen(true);
                      if (isChatFullscreen) setIsChatFullscreen(false);
                    }
                  }}
                  className={
                    isExecutionLogsVisible
                      ? 'border-none bg-om-elevated text-white'
                      : 'text-gray-400 hover:text-white'
                  }
                  title={
                    !isExecutionLogsVisible
                      ? 'Show Execution Logs'
                      : isLogsFullscreen
                        ? 'Minimize Logs'
                        : 'Expand Logs'
                  }
                />
              </>
            )}
            {shouldShowLogsButton && (
              <Button
                type={isLogsTerminalVisible ? 'primary' : 'text'}
                size='small'
                icon={<CodeOutlined />}
                onClick={() => setIsLogsTerminalVisible(!isLogsTerminalVisible)}
                className={
                  isLogsTerminalVisible
                    ? 'border-none bg-om-elevated text-white'
                    : 'text-gray-400 hover:text-white'
                }
                title='Toggle Logs Terminal'
              />
            )}
          </div>
        </div>
        <div className='flex items-center gap-3'>
          {latestScript?.scriptConfigId && (
            <>
              <Button
                type='default'
                icon={<PlayCircleOutlined />}
                onClick={async () => {
                  if (!isScriptActive) {
                    antdMessage.error('Script must be active to run');
                    return;
                  }
                  try {
                    await runOrResumeScript(
                      scriptName || project?.scriptName || '',
                    );
                    antdMessage.success('Script started');
                    navigate('/config?tab=scripts');
                  } catch (e: any) {
                    antdMessage.error(e?.message || 'Failed to run script');
                  }
                }}
                disabled={isAiRunning}
                className={
                  isAiRunning
                    ? 'cursor-not-allowed border border-om-border bg-om-elevated text-gray-600 shadow-none'
                    : 'border border-om-border-strong bg-om-elevated text-white hover:border-purple-500 hover:text-purple-400'
                }
              >
                Run Script
              </Button>
              <Button
                type='primary'
                icon={
                  isScriptActive ? <StopOutlined /> : <PlayCircleOutlined />
                }
                onClick={handleActivateScript}
                disabled={isAiRunning}
                className={
                  isAiRunning
                    ? 'cursor-not-allowed border border-om-border bg-om-elevated text-gray-600 shadow-none'
                    : isScriptActive
                      ? 'border border-purple-600 bg-black text-purple-500 shadow-lg shadow-purple-900/20 hover:border-purple-500 hover:text-purple-400'
                      : 'border-none bg-purple-600 shadow-lg shadow-purple-900/20 hover:bg-purple-500'
                }
              >
                {isScriptActive ? 'Deactivate' : 'Activate Agent'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className='relative flex min-h-0 w-full flex-1 flex-col overflow-hidden'>
        {effectiveScriptName && versionLists && (
          <div className='shrink-0 border-b border-om-border bg-om-panel px-4 py-2'>
            <div className='flex flex-wrap items-center gap-2 text-xs'>
              <HistoryOutlined className='text-gray-500' />
              <span className='font-semibold uppercase tracking-wide text-gray-500'>
                Versions
              </span>
              {versionListsLoading && <Spin size='small' />}
              {versionLists.unarchived.map((v) => {
                const isRowActive =
                  versionLists.activeCfgId != null &&
                  canonicalScriptCfgId(v.id, effectiveScriptName) ===
                    canonicalScriptCfgId(versionLists.activeCfgId, effectiveScriptName);
                const isSelectedPreview = versionPreview?.cfgId === v.id;
                return (
                  <Button
                    key={v.id}
                    size='small'
                    loading={loadingVersionCfgId === v.id}
                    type={isSelectedPreview ? 'primary' : 'default'}
                    onClick={() =>
                      openVersionPreview(
                        v.id,
                        (v.description || '').trim() || 'Untitled version',
                      )
                    }
                    className='text-xs'
                  >
                    {(v.description || '').trim() || 'Untitled version'}
                    {isRowActive ? ' · Active' : ''}
                  </Button>
                );
              })}
              {versionLists.archived.length > 0 && (
                <Button
                  type='link'
                  size='small'
                  className='text-xs text-gray-400'
                  onClick={() => setShowArchivedVersions((s) => !s)}
                >
                  {showArchivedVersions ? 'Hide archived' : 'Show archived'}
                </Button>
              )}
              {showArchivedVersions &&
                versionLists.archived.map((v) => (
                  <Button
                    key={`a-${v.id}`}
                    size='small'
                    loading={loadingVersionCfgId === v.id}
                    type={versionPreview?.cfgId === v.id ? 'primary' : 'default'}
                    onClick={() =>
                      openVersionPreview(
                        v.id,
                        (v.description || '').trim() || 'Untitled version',
                      )
                    }
                    className='text-xs text-gray-400'
                  >
                    {(v.description || '').trim() || 'Untitled'} (archived)
                  </Button>
                ))}
              {versionPreview && (
                <>
                  <Button
                    size='small'
                    type='primary'
                    onClick={() => void handleActivatePreviewVersion()}
                  >
                    Activate this version
                  </Button>
                  <Button size='small' onClick={closeVersionPreview}>
                    Close preview
                  </Button>
                </>
              )}
            </div>
            {versionPreview && (
              <div
                className='mt-2 rounded border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95'
                role='status'
              >
                Viewing: &ldquo;{versionPreview.label}&rdquo; — read-only. Close
                preview to edit project files. Press Esc to exit preview.
              </div>
            )}
          </div>
        )}
        <div
          className='relative flex min-h-0 w-full flex-1 flex-row overflow-hidden'
          ref={containerRef}
        >
          {/* Left Section: Files + Editor */}
          <div
            className='flex h-full flex-col'
            style={{ flex: 1, minWidth: 0 }}
          >
            <div className='flex flex-1 overflow-hidden'>
              {/* Files Pane */}
              {isFilesVisible && (
                <div
                  style={{ width: `${filesWidth}%` }}
                  className='flex min-w-[150px] flex-col border-r border-om-border bg-om-page'
                >
                  <div className='flex items-center justify-between border-b border-om-border bg-om-panel p-3 text-xs text-gray-400'>
                    <div className='flex items-center gap-2 font-bold text-gray-300'>
                      <FolderOutlined className='text-sm' />{' '}
                      {scriptName || 'Agent Files'}
                    </div>
                    {!versionPreview && (
                      <div className='flex items-center gap-1'>
                        <Button
                          type='text'
                          size='small'
                          icon={<PlusOutlined />}
                          onClick={() => addFile()}
                          className='text-xs text-gray-400 hover:text-white'
                          title='Add File'
                        />
                        <Button
                          type='text'
                          size='small'
                          icon={<FolderOutlined />}
                          onClick={() => addFolder()}
                          className='text-xs text-gray-400 hover:text-white'
                          title='Add Folder'
                        />
                      </div>
                    )}
                  </div>
                  <div className='flex-1 overflow-auto p-2'>
                    {generatedFiles.length === 0 ? (
                      <div className='mt-4 text-center text-xs text-gray-500'>
                        There are no files. Click + to add files or folders.
                      </div>
                    ) : (
                      renderFileTree(generatedFiles)
                    )}
                  </div>
                </div>
              )}

              {/* Files Resizer */}
              {isFilesVisible && (
                <div
                  className={`w-1 cursor-col-resize border-r border-om-border bg-om-panel transition-colors hover:bg-purple-600 ${isDraggingFiles ? 'bg-purple-600' : ''}`}
                  onMouseDown={() => setIsDraggingFiles(true)}
                />
              )}

              {/* Editor Pane */}
              <div className='flex min-w-0 flex-1 flex-col bg-om-panel font-mono text-xs'>
                <div className='flex h-9 items-center justify-between gap-2 border-b border-om-border px-4 text-gray-500'>
                  <div className='flex items-center gap-2'>
                    {selectedFile ? (
                      <>
                        <FileTextOutlined className='text-sm' />
                        <span className='text-purple-400'>{selectedFile}</span>
                      </>
                    ) : generatedFiles.length === 0 ? null : (
                      <span className='text-gray-500'>
                        Select a file to view
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-2'>
                    <Button
                      type={hasChanges() ? 'primary' : 'default'}
                      size='small'
                      icon={<SaveOutlined />}
                      onClick={handleSaveFiles}
                      loading={isSaving}
                      disabled={!hasChanges() || !!versionPreview}
                      className={
                        hasChanges()
                          ? 'border-none bg-purple-600 text-xs text-white hover:bg-purple-500'
                          : 'border-gray-700 bg-transparent text-xs text-gray-500 hover:border-gray-600 hover:text-gray-400'
                      }
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>

                <div className='flex flex-1 flex-col overflow-hidden'>
                  {selectedFile ? (
                    <>
                      <div className='flex-1 overflow-hidden bg-om-muted'>
                        <Editor
                          height='100%'
                          language={
                            selectedFile.endsWith('.go')
                              ? 'go'
                              : selectedFile.endsWith('.json')
                                ? 'json'
                                : selectedFile.endsWith('.yaml') ||
                                    selectedFile.endsWith('.yml')
                                  ? 'yaml'
                                  : selectedFile.endsWith('.md')
                                    ? 'markdown'
                                    : selectedFile.endsWith('.ts') ||
                                        selectedFile.endsWith('.tsx')
                                      ? 'typescript'
                                      : selectedFile.endsWith('.js') ||
                                          selectedFile.endsWith('.jsx')
                                        ? 'javascript'
                                        : 'plaintext'
                          }
                          theme={monacoTheme}
                          value={editedFileContent}
                          onChange={(value: string | undefined) => {
                            const content = value || '';
                            setEditedFileContent(content);
                            updateFileContent(selectedFile, content);
                          }}
                          loading={
                            <div className='flex h-full items-center justify-center text-gray-500'>
                              Loading Editor...
                            </div>
                          }
                          options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            fontFamily: '"Fira Code", "Fira Mono", monospace',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 16, bottom: 16 },
                            wordWrap: 'on',
                            readOnly: !!versionPreview,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className='flex h-full items-center justify-center text-gray-500'>
                      <Empty
                        description={
                          <span className='text-gray-500'>
                            {generatedFiles.length === 0
                              ? 'No files available. Create one to get started.'
                              : 'Select a file from the tree to view or edit its contents'}
                          </span>
                        }
                      />
                    </div>
                  )}
                </div>
                {/* Terminal inside Editor Pane */}
                <LogsTerminal
                  isVisible={isLogsTerminalVisible}
                  isActive={isScriptActive}
                  onClose={() => setIsLogsTerminalVisible(false)}
                  scriptName={scriptName || null}
                  onGoToScriptTab={() => navigate('/config?tab=scripts')}
                  className='shrink-0 border-t border-om-border'
                />
              </div>
            </div>
          </div>

          {/* UI Renderer Panel */}
          {isRendererVisible &&
            AGENTS_WITH_UI_RENDERER.has(scriptName || '') && (
              <>
                <div
                  className={`w-1 cursor-col-resize bg-om-elevated transition-colors ${isDraggingRenderer ? 'bg-emerald-600' : 'hover:bg-emerald-600'}`}
                  onMouseDown={() => setIsDraggingRenderer(true)}
                />
                <div
                  className='flex shrink-0 flex-col overflow-hidden border-l border-om-border bg-om-page'
                  style={{
                    width: `${rendererWidth}px`,
                    minWidth: '280px',
                    maxWidth: '800px',
                  }}
                >
                  {/* Panel header */}
                  <div className='flex h-9 shrink-0 items-center gap-2 border-b border-om-border bg-om-panel px-3'>
                    <DesktopOutlined className='text-sm text-emerald-400' />
                    <span className='text-xs font-semibold text-gray-200'>
                      Live UI Preview
                    </span>
                    <span className='ml-1 rounded border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400'>
                      {scriptName}
                    </span>
                    <button
                      onClick={() => setIsRendererVisible(false)}
                      className='ml-auto text-xs text-gray-600 transition-colors hover:text-gray-300'
                      title='Close Preview'
                    >
                      ✕
                    </button>
                  </div>
                  {/* Renderer body */}
                  <div className='min-h-0 flex-1 overflow-hidden'>
                    <AgentUIRenderer agentName={scriptName || null} />
                  </div>
                </div>
              </>
            )}

          {/* Chat Resizer */}
          {isAlphaEnabled() &&
            isChatVisible &&
            !isChatFullscreen &&
            !isLogsFullscreen && (
              <div
                className={`w-1 cursor-col-resize bg-om-elevated transition-colors hover:bg-purple-600 ${isDraggingChat ? 'bg-purple-600' : ''}`}
                onMouseDown={() => setIsDraggingChat(true)}
              />
            )}

          {/* Middle-Right Section: Chat */}
          {isAlphaEnabled() && isChatVisible && !isLogsFullscreen && (
            <div
              style={{
                width: isChatFullscreen ? '100%' : `${chatWidth}%`,
                position: isChatFullscreen ? 'absolute' : 'relative',
                left: 0,
                top: 0,
                zIndex: isChatFullscreen ? 50 : 'auto',
              }}
              className='group relative flex h-full flex-col border-l border-om-border bg-om-page'
            >
              <div
                className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden ${isChatFullscreen ? 'w-full' : ''}`}
              >
                {project && !project.isAIProject ? (
                  <div className='flex h-full flex-col items-center justify-center p-6 text-center'>
                    <RobotOutlined className='mb-4 text-4xl text-purple-500' />
                    <h3 className='mb-2 text-lg font-bold text-white'>
                      Enable AI Assistance
                    </h3>
                    <p className='mb-6 text-sm text-gray-400'>
                      Turn this into an AI-powered project to get intelligent
                      code generation and assistance.
                    </p>
                    <Button
                      type='primary'
                      onClick={handleEnableAI}
                      className='border-none bg-purple-600 shadow-lg shadow-purple-900/20 hover:bg-purple-500'
                    >
                      Turn into AI Project
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4'
                      ref={listRef}
                      onScroll={handleChatScroll}
                    >
                      {messages.length === 0 ? (
                        <div className='flex h-full items-center justify-center'>
                          <Empty
                            description={
                              <span className='text-gray-500'>
                                Start chatting with AI to generate your agent...
                              </span>
                            }
                          />
                        </div>
                      ) : (
                        <Space
                          direction='vertical'
                          size={12}
                          style={{ width: '100%' }}
                        >
                          {messages.map((m) => {
                            // If it's the last message, ASSISTANT, empty content -> Don't render ChatBubble, render ThinkingIndicator
                            if (
                              m.role === MessageRole.ASSISTANT &&
                              !m.content &&
                              m.id === messages[messages.length - 1].id
                            ) {
                              return null;
                            }

                            const chunks = messageChunks.get(m.id);
                            // Calculate duration
                            let duration = 0;
                            if (chunks && chunks.length > 0) {
                              const start = new Date(
                                chunks[0].createdAt,
                              ).getTime();
                              const end = new Date(
                                chunks[chunks.length - 1].createdAt,
                              ).getTime();
                              duration = (end - start) / 1000;
                            }

                            return (
                              <ChatBubble
                                key={m.id}
                                {...m}
                                chunks={chunks}
                                onShowThoughtProcess={() =>
                                  toggleThoughtProcess(m.id)
                                }
                                isThoughtProcessVisible={thoughtProcessVisible.get(
                                  m.id,
                                )}
                                thoughtDuration={duration}
                              />
                            );
                          })}
                          {messages.length > 0 &&
                            (messages[messages.length - 1].role ===
                              MessageRole.USER ||
                              (messages[messages.length - 1].role ===
                                MessageRole.ASSISTANT &&
                                !messages[messages.length - 1].content)) && (
                              <div className='flex w-full justify-start'>
                                <div className='mb-4 flex max-w-[85%] flex-row gap-3'>
                                  <Avatar
                                    icon={<RobotOutlined />}
                                    className='shrink-0 bg-purple-600'
                                  />
                                  <ThinkingIndicator
                                    progress={thinkingProgress}
                                    isExpanded={isThinkingExpanded}
                                    onToggle={() =>
                                      setIsThinkingExpanded(!isThinkingExpanded)
                                    }
                                    initialDuration={thinkingDuration}
                                  />
                                </div>
                              </div>
                            )}
                          {activationPromptVisible && (
                            <div className='animate-in fade-in slide-in-from-bottom-2 flex w-full justify-start duration-300'>
                              <div className='flex max-w-[85%] flex-row gap-3'>
                                <Avatar
                                  icon={<CodeOutlined />}
                                  className='shrink-0 bg-purple-600'
                                />
                                <div className='flex flex-col items-start rounded-2xl rounded-tl-sm border border-purple-500/20 bg-purple-500/10 p-4 text-gray-100'>
                                  <p className='mb-3 text-sm font-medium'>
                                    I'd like to activate this script to verify
                                    functionality. Proceed?
                                  </p>
                                  <div className='flex gap-2'>
                                    <Button
                                      type='primary'
                                      size='small'
                                      onClick={() =>
                                        handleActivationResponse(true)
                                      }
                                      className='border-none bg-purple-600 hover:bg-purple-500'
                                    >
                                      Allow
                                    </Button>
                                    <Button
                                      size='small'
                                      onClick={() =>
                                        handleActivationResponse(false)
                                      }
                                      className='border border-gray-600 bg-transparent text-gray-400 hover:border-gray-500 hover:text-white'
                                    >
                                      Skip
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Space>
                      )}
                    </div>

                    <div className='flex-shrink-0 shrink-0 border-t border-om-border bg-om-panel p-4'>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input.TextArea
                          autoSize={{ minRows: 1, maxRows: 12 }}
                          placeholder='Describe your agent requirements...'
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onPressEnter={(e) => {
                            if (!e.shiftKey) {
                              e.preventDefault();
                              if (!sending && !streamingMessageId) {
                                onSend();
                              }
                            }
                          }}
                          className='border-om-border-strong bg-om-elevated text-white'
                        />
                        <Button
                          type='primary'
                          icon={<SendOutlined />}
                          loading={sending}
                          onClick={onSend}
                          disabled={
                            sending ||
                            streamingMessageId !== null ||
                            !input.trim() ||
                            (messages.length > 0 &&
                              messages[messages.length - 1].role ===
                                MessageRole.USER)
                          }
                        >
                          Send
                        </Button>
                        {sending && (
                          <Button
                            icon={<StopOutlined />}
                            onClick={onStop}
                            danger
                          >
                            Stop
                          </Button>
                        )}
                      </Space.Compact>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Execution Logs Resizer */}
          {isAlphaEnabled() &&
            isExecutionLogsVisible &&
            !isLogsFullscreen &&
            !isChatFullscreen && (
              <div
                className={`w-1 cursor-col-resize bg-om-elevated transition-colors hover:bg-purple-600 ${
                  isDraggingExecutionLogs ? 'bg-purple-600' : ''
                }`}
                onMouseDown={() => setIsDraggingExecutionLogs(true)}
              />
            )}

          {/* Far Right Section: Execution Logs Sidebar */}
          {isAlphaEnabled() && isExecutionLogsVisible && !isChatFullscreen && (
            <div
              className='group relative flex h-full flex-shrink-0 flex-col border-l border-om-border bg-om-page'
              style={{
                width: isLogsFullscreen ? '100%' : `${executionLogsWidth}px`,
                position: isLogsFullscreen ? 'absolute' : 'relative',
                left: 0,
                top: 0,
                zIndex: isLogsFullscreen ? 50 : 'auto',
              }}
            >
              <InngestExecutionLogs
                projectId={projectId}
                isVisible={isExecutionLogsVisible}
                onToggle={() => setIsExecutionLogsVisible(false)}
              />
            </div>
          )}
        </div>

        <Modal
          title='Script is active'
          open={isActiveModalOpen}
          onOk={() => setIsActiveModalOpen(false)}
          onCancel={() => setIsActiveModalOpen(false)}
          footer={[
            <Button key='close' onClick={() => setIsActiveModalOpen(false)}>
              Close
            </Button>,
            <Button
              key='go'
              type='primary'
              onClick={() => navigate('/config?tab=scripts')}
            >
              Go to Scripts Tab
            </Button>,
          ]}
        >
          <p>The script has been activated.</p>
        </Modal>
      </div>

      <Modal
        title='Create New File'
        open={isCreateFileModalOpen}
        onOk={handleCreateFile}
        onCancel={() => setIsCreateFileModalOpen(false)}
        okText='Create'
        okButtonProps={{ className: 'bg-purple-600' }}
      >
        <Input
          placeholder='Enter file name (e.g., main.go)'
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onPressEnter={handleCreateFile}
          autoFocus
        />
      </Modal>

      <Modal
        title='Create New Folder'
        open={isCreateFolderModalOpen}
        onOk={handleCreateFolder}
        onCancel={() => setIsCreateFolderModalOpen(false)}
        okText='Create'
        okButtonProps={{ className: 'bg-purple-600' }}
      >
        <Input
          placeholder='Enter folder name'
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onPressEnter={handleCreateFolder}
          autoFocus
        />
      </Modal>

      <Modal
        title='Delete Item'
        open={isDeleteModalOpen}
        onOk={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        okText='Delete'
        okButtonProps={{ danger: true }}
      >
        <p>
          Are you sure you want to delete <strong>{itemToDelete}</strong>?
        </p>
        <p className='mt-2 text-xs text-gray-500'>
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
function ThinkingIndicator({
  progress,
  isExpanded,
  onToggle,
  duration,
  initialDuration = 0,
}: {
  progress: string[];
  isExpanded: boolean;
  onToggle: () => void;
  duration?: number;
  initialDuration?: number;
}) {
  const [seconds, setSeconds] = useState(initialDuration);

  useEffect(() => {
    setSeconds(initialDuration);
  }, [initialDuration]);

  useEffect(() => {
    if (progress.length === 0) return;
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [progress.length === 0]);

  const displayDuration = duration !== undefined ? duration : seconds;

  return (
    <div className='flex flex-col items-start'>
      <div className='rounded-2xl rounded-tl-sm border border-purple-500/20 bg-purple-500/10 px-4 py-3'>
        <div className='flex items-center gap-2'>
          <span className='animate-pulse text-sm font-medium text-purple-300'>
            Thinking...{' '}
            {displayDuration > 0 &&
              `(${displayDuration < 60 ? `${displayDuration.toFixed(1)}s` : `${Math.floor(displayDuration / 60)}m ${(displayDuration % 60).toFixed(0)}s`})`}
          </span>
          {progress.length > 0 && (
            <Button
              type='text'
              size='small'
              icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
              onClick={onToggle}
              className='flex h-5 w-5 items-center justify-center text-purple-400 hover:text-purple-300'
            />
          )}
        </div>
        {isExpanded && progress.length > 0 && (
          <div className='mt-2 space-y-1 border-l-2 border-purple-500/30 pl-2'>
            {progress.map((step, i) => (
              <div
                key={i}
                className='animate-in fade-in slide-in-from-left-2 text-xs text-gray-400 duration-300'
              >
                {step}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatBubble(
  props: Message & {
    chunks?: MessageChunk[];
    onShowThoughtProcess?: () => void;
    isThoughtProcessVisible?: boolean;
    thoughtDuration?: number;
  },
) {
  const {
    role,
    content,
    createdAt,
    chunks,
    onShowThoughtProcess,
    isThoughtProcessVisible,
    thoughtDuration,
  } = props;
  const isUser = role === MessageRole.USER;

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-[85%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <Avatar
          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
          className={`shrink-0 ${isUser ? 'bg-om-active' : 'bg-purple-600'}`}
        />
        <div
          className={`flex min-w-0 flex-col ${isUser ? 'items-end' : 'items-start'} group`}
        >
          <div
            className={`w-full break-words rounded-2xl px-4 py-3 text-sm shadow-sm ${
              isUser
                ? 'rounded-tr-sm bg-om-elevated text-gray-100'
                : 'rounded-tl-sm border border-purple-500/20 bg-purple-500/10 text-gray-100'
            }`}
          >
            {!isUser && (
              <div className='mb-2'>
                <Button
                  size='small'
                  type='text'
                  className='flex h-auto items-center gap-1 p-0 text-purple-300 hover:text-purple-200'
                  onClick={onShowThoughtProcess}
                >
                  {isThoughtProcessVisible ? (
                    <DownOutlined />
                  ) : (
                    <RightOutlined />
                  )}
                  <span className='font-medium'>Thought Process</span>
                  {isThoughtProcessVisible && thoughtDuration !== undefined && (
                    <span className='text-xs text-purple-400/70'>
                      (
                      {thoughtDuration < 60
                        ? `${thoughtDuration.toFixed(1)}s`
                        : `${Math.floor(thoughtDuration / 60)}m ${(thoughtDuration % 60).toFixed(0)}s`}
                      )
                    </span>
                  )}
                </Button>

                {isThoughtProcessVisible && chunks && (
                  <div className='mb-3 mt-2 space-y-1 border-l-2 border-purple-500/30 pl-2'>
                    {chunks.map((chunk) => (
                      <div key={chunk.id} className='text-xs text-gray-400'>
                        {chunk.response}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {content ? (
              <ReactMarkdown
                remarkPlugins={[remarkBreaks]}
                components={{
                  p: ({ node: _node, ...props }) => (
                    <p className='mb-2 last:mb-0' {...props} />
                  ),
                  ul: ({ node: _node, ...props }) => (
                    <ul className='mb-2 list-disc pl-4' {...props} />
                  ),
                  ol: ({ node: _node, ...props }) => (
                    <ol className='mb-2 list-decimal pl-4' {...props} />
                  ),
                  li: ({ node: _node, ...props }) => (
                    <li className='mb-1' {...props} />
                  ),
                  code: ({ node: _node, ...props }) => {
                    const { className, children } = props;
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !String(children).includes('\n');
                    return isInline ? (
                      <code
                        className='break-all rounded bg-black/30 px-1 py-0.5 font-mono text-xs'
                        {...props}
                      />
                    ) : (
                      <code
                        className='mb-2 block overflow-x-auto rounded bg-black/30 p-2 font-mono text-xs'
                        {...props}
                      />
                    );
                  },
                  pre: ({ node: _node, ...props }) => (
                    <pre
                      className='mb-2 max-w-full overflow-x-auto rounded bg-black/30 p-2 font-mono text-xs'
                      {...props}
                    />
                  ),
                  strong: ({ node: _node, ...props }) => (
                    <strong className='font-bold text-purple-300' {...props} />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            ) : (
              <i className='text-gray-500'>…</i>
            )}
          </div>
          <span
            className={`mt-1 text-[10px] text-gray-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${isUser ? 'text-right' : 'text-left'}`}
          >
            {new Date(createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

