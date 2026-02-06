/**
 * Claude Code Plugin Loader for Pi
 *
 * Loads Claude Code plugins and registers their commands/skills.
 * Commands are invoked as /plugin-name:command-name
 *
 * Config file: cc-plugins.json (in same directory)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

interface PluginConfig {
  source: string;
  name?: string;
  enabled?: boolean;
  /** Project directories where this plugin is available. Empty = global. */
  projects?: string[];
}

interface Config {
  plugins: PluginConfig[];
}

interface PluginManifest {
  name: string;
  version?: string;
  description?: string;
}

interface LoadedCommand {
  name: string;
  description: string;
  content: string;
  filePath: string;
  argumentHint?: string;
}

interface LoadedSkill {
  name: string;
  description: string;
  content: string;
  filePath: string;
}

interface LoadedPlugin {
  name: string;
  version?: string;
  description?: string;
  path: string;
  commands: LoadedCommand[];
  skills: LoadedSkill[];
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { frontmatter, body: match[2] };
}

function resolvePluginPath(source: string): string | null {
  let resolved = source.startsWith("~")
    ? path.join(process.env.HOME ?? "", source.slice(1))
    : source;
  if (!path.isAbsolute(resolved)) resolved = path.resolve(resolved);
  return fs.existsSync(resolved) ? resolved : null;
}

function loadManifest(pluginPath: string): PluginManifest | null {
  const manifestPath = path.join(pluginPath, ".claude-plugin", "plugin.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return null;
  }
}

function loadCommands(pluginPath: string): LoadedCommand[] {
  const commandsDir = path.join(pluginPath, "commands");
  if (!fs.existsSync(commandsDir)) return [];

  const commands: LoadedCommand[] = [];
  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith(".md")) continue;
    const filePath = path.join(commandsDir, file);
    const { frontmatter, body } = parseFrontmatter(fs.readFileSync(filePath, "utf-8"));
    commands.push({
      name: file.replace(/\.md$/, ""),
      description: frontmatter.description ?? `Command: ${file}`,
      content: body,
      filePath,
      argumentHint: frontmatter["argument-hint"],
    });
  }
  return commands;
}

function loadSkills(pluginPath: string): LoadedSkill[] {
  const skillsDir = path.join(pluginPath, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const skills: LoadedSkill[] = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;
    const { frontmatter, body } = parseFrontmatter(fs.readFileSync(skillPath, "utf-8"));
    skills.push({
      name: frontmatter.name ?? entry.name,
      description: frontmatter.description ?? `Skill: ${entry.name}`,
      content: body,
      filePath: skillPath,
    });
  }
  return skills;
}

function loadPlugin(config: PluginConfig): LoadedPlugin | null {
  const pluginPath = resolvePluginPath(config.source);
  if (!pluginPath) return null;
  const manifest = loadManifest(pluginPath);
  if (!manifest) return null;

  return {
    name: config.name ?? manifest.name,
    version: manifest.version,
    description: manifest.description,
    path: pluginPath,
    commands: loadCommands(pluginPath),
    skills: loadSkills(pluginPath),
  };
}

function substituteArguments(content: string, args: string): string {
  return content.replace(/\$ARGUMENTS/g, args);
}

export default function (pi: ExtensionAPI) {
  const configPath = path.join(__dirname, "cc-plugins.json");

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ plugins: [] }, null, 2));
    return;
  }

  let config: Config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return;
  }

  if (!config.plugins?.length) return;

  const cwd = process.cwd();

  const loadedPlugins: LoadedPlugin[] = [];
  for (const pluginConfig of config.plugins) {
    if (pluginConfig.enabled === false) continue;
    
    // Check projects - if specified, only load when cwd is within one of them
    if (pluginConfig.projects?.length) {
      const inProject = pluginConfig.projects.some((proj) => {
        let projectDir = proj;
        if (projectDir.startsWith("~")) {
          projectDir = path.join(process.env.HOME ?? "", projectDir.slice(1));
        }
        projectDir = path.resolve(projectDir);
        return cwd.startsWith(projectDir);
      });
      
      if (!inProject) continue;
    }
    
    const plugin = loadPlugin(pluginConfig);
    if (plugin) loadedPlugins.push(plugin);
  }

  const commandMap = new Map<string, { content: string; isSkill: boolean }>();

  for (const plugin of loadedPlugins) {
    for (const cmd of plugin.commands) {
      commandMap.set(`/${plugin.name}:${cmd.name}`, { content: cmd.content, isSkill: false });
    }
    for (const skill of plugin.skills) {
      commandMap.set(`/${plugin.name}:${skill.name}`, { content: skill.content, isSkill: true });
    }
  }

  // Pending prompt injection
  let pendingPrompt: { command: string; content: string } | null = null;

  // Register commands for autocomplete
  for (const plugin of loadedPlugins) {
    for (const cmd of plugin.commands) {
      const commandName = `${plugin.name}:${cmd.name}`;
      const commandKey = `/${plugin.name}:${cmd.name}`;

      pi.registerCommand(commandName, {
        description: cmd.description,
        handler: async (args, _ctx) => {
          const entry = commandMap.get(commandKey)!;
          const expandedContent = substituteArguments(entry.content, args ?? "");
          
          // Store for injection
          pendingPrompt = { command: commandKey, content: expandedContent };
          
          // Show command with arguments if present
          const displayMessage = args ? `${commandKey} ${args}` : commandKey;
          pi.sendUserMessage(displayMessage);
        },
      });
    }

    for (const skill of plugin.skills) {
      const skillName = `${plugin.name}:${skill.name}`;
      const commandKey = `/${plugin.name}:${skill.name}`;

      pi.registerCommand(skillName, {
        description: skill.description,
        handler: async (args, _ctx) => {
          const entry = commandMap.get(commandKey)!;
          let content = entry.content;
          if (args) content += `\n\nUser: ${args}`;
          
          // Store for injection
          pendingPrompt = { command: commandKey, content };
          
          // Show command with arguments if present
          const displayMessage = args ? `${commandKey} ${args}` : commandKey;
          pi.sendUserMessage(displayMessage);
        },
      });
    }
  }

  // Inject full prompt into system prompt
  pi.on("before_agent_start", async (event, _ctx) => {
    if (!pendingPrompt) return;

    const { content } = pendingPrompt;
    pendingPrompt = null;

    // Append the command content to the system prompt
    return {
      systemPrompt: event.systemPrompt + "\n\n---\n\nThe user has invoked a command. Execute the following instructions:\n\n" + content,
    };
  });

  // List command
  pi.registerCommand("cc-plugins", {
    description: "List loaded Claude Code plugin commands",
    handler: async (_args, ctx) => {
      const lines = ["Claude Code Plugins:"];
      for (const plugin of loadedPlugins) {
        lines.push(`\n${plugin.name}${plugin.version ? ` v${plugin.version}` : ""}:`);
        if (plugin.commands.length) {
          lines.push("  Commands:");
          for (const cmd of plugin.commands) {
            lines.push(`    /${plugin.name}:${cmd.name} - ${cmd.description}`);
          }
        }
        if (plugin.skills.length) {
          lines.push("  Skills:");
          for (const skill of plugin.skills) {
            lines.push(`    /${plugin.name}:${skill.name} - ${skill.description}`);
          }
        }
      }
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // Log loaded plugins
  for (const plugin of loadedPlugins) {
    if (plugin.commands.length + plugin.skills.length > 0) {
      console.log(
        `[cc-plugins] Loaded ${plugin.name}${plugin.version ? `@${plugin.version}` : ""}: ` +
          `${plugin.commands.length} commands, ${plugin.skills.length} skills`
      );
    }
  }
}
