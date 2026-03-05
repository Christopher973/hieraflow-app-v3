"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OrgChart from "@balkangraph/orgchart.js";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { useOrganigram } from "@/src/hooks/use-organigram";
import { useDepartments } from "@/src/hooks/use-departments";
import { useSectors } from "@/src/hooks/use-sectors";
import { showErrorToast } from "@/src/lib/show-error-toast";
import { getNameFallback } from "@/src/lib/utils";
import type {
  OrganigramNodeDto,
  OrganigramSectorDto,
} from "@/src/types/organigram";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";

// Types pour les fonctionnalités non typées d'OrgChart
interface OrgChartWithExport {
  exportToPDF?: (options: { fileName: string; openInNewTab: boolean }) => void;
  exportToPNG?: (options: { fileName: string; openInNewTab: boolean }) => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  fit?: () => void;
  draw?: (action?: unknown) => void;
  config?: {
    layout?: number;
  };
}

interface OrgChartWithSearchUI extends OrgChartWithExport {
  searchUI?: {
    searchFieldsAbbreviation?: Record<string, string>;
    helpView?: () => string;
  };
  shareProfile?: (id: string | number) => void;
}

interface WindowWithChart extends Window {
  chart?: OrgChart | null;
}
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxLabel,
} from "../ui/combobox";
import { Spinner } from "../ui/spinner";

interface OrgNode {
  id: number;
  pid?: number;
  name: string;
  positionType:
    | "DIRECTEUR"
    | "SOUS_DIRECTEUR"
    | "CHEF_SERVICE"
    | "RESPONSABLE"
    | "COLLABORATEUR"
    | "ASSISTANT";
  department: string;
  sector: string;
  departmentId: number;
  sectorId: number | null;
  tags?: string[];
  title?: string;
  img?: string;
  isVacant: boolean;
  memberId?: number;
  serviceCode?: string;
  firstname?: string;
  lastname?: string;
  gender?: "HOMME" | "FEMME" | "AUTRE";
  birthday?: string;
  isReferentRH?: boolean;
  professionalEmail?: string;
  phone?: string;
  locationName?: string;
  startDate?: string;
  endDate?: string;
  avatarUrl?: string;
  detailsUrl?: string;
  avatar?: string;
  nom?: string;
  prenom?: string;
  nomComplet?: string;
  codeAssignation?: string;
  genreLabel?: string;
  dateNaissanceLabel?: string;
  referentRHLabel?: string;
  emailProfessionnelLabel?: string;
  telephoneLabel?: string;
  localisationLabel?: string;
  dateEntreeLabel?: string;
  dateFinLabel?: string;
  fonction?: string;
  departementLabel?: string;
  secteurLabel?: string;
  referentRHBadge?: string;
}

const EMPTY_SECTORS: OrganigramSectorDto[] = [];
const EMPTY_NODES: OrganigramNodeDto[] = [];
const VACANT_IMAGE_PATH = "/images/poste-vacant.png";
const SEARCH_FIELD_LABELS: Record<string, string> = {
  nom: "Nom",
  prenom: "Prénom",
  fonction: "Fonction",
};

type LayoutKey =
  | "treeRightOffset"
  | "treeLeftOffset"
  | "tree"
  | "normal"
  | "mixed";

const LAYOUT_OPTIONS: Array<{ value: LayoutKey; label: string }> = [
  { value: "treeRightOffset", label: "Arbre (droite décalée)" },
  { value: "treeLeftOffset", label: "Arbre (gauche décalée)" },
  { value: "tree", label: "Arbre" },
  { value: "normal", label: "Normal" },
  { value: "mixed", label: "Mixte" },
];

const LAYOUT_TO_ORGCHART: Record<LayoutKey, number> = {
  treeRightOffset: OrgChart.treeRightOffset,
  treeLeftOffset: OrgChart.treeLeftOffset,
  tree: OrgChart.tree,
  normal: OrgChart.normal,
  mixed: OrgChart.mixed,
};

const formatDateFr = (value?: string) => {
  if (!value) {
    return "Non définie";
  }

  return new Date(value).toLocaleDateString("fr-FR");
};

const toGenderFr = (value?: "HOMME" | "FEMME" | "AUTRE") => {
  if (value === "HOMME") return "Homme";
  if (value === "FEMME") return "Femme";
  if (value === "AUTRE") return "Autre";
  return "Non renseigné";
};

const createInitialsAvatarDataUri = (initials: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#e5e7eb"/><text x="60" y="68" text-anchor="middle" font-size="36" font-family="Arial, sans-serif" fill="#111827" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const withTextOverflow = (
  fieldTemplate: string,
  width: number,
  overflow: "ellipsis" | "multiline-2-ellipsis" | "multiline-3-ellipsis",
) => {
  let template = fieldTemplate;

  if (/data-width="[^"]*"/.test(template)) {
    template = template.replace(/data-width="[^"]*"/, `data-width="${width}"`);
  } else {
    template = template.replace("<text ", `<text data-width="${width}" `);
  }

  if (/data-text-overflow="[^"]*"/.test(template)) {
    template = template.replace(
      /data-text-overflow="[^"]*"/,
      `data-text-overflow="${overflow}"`,
    );
  } else {
    template = template.replace(
      "<text ",
      `<text data-text-overflow="${overflow}" `,
    );
  }

  return template;
};

export default function Organigram() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<OrgChart | null>(null);
  const chartNodesByIdRef = useRef<Map<number, OrgNode>>(new Map());
  const searchParams = useSearchParams();

  // Initialisation des filtres à partir des query params (initial render)
  const initialDepartment =
    searchParams?.get("departmentId") ?? searchParams?.get("department") ?? "";
  const initialRawSectors =
    searchParams?.get("sectorIds") ??
    searchParams?.get("sectorsId") ??
    searchParams?.get("sectorId");
  const initialPendingSectors = initialRawSectors
    ? initialRawSectors
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const [departmentFilter, setDepartmentFilter] = useState<string>(
    () => initialDepartment,
  );
  const [sectorFilter, setSectorFilter] = useState<string[]>([]);
  const [layout, setLayout] = useState<LayoutKey>("tree");
  // Si un param `sectorIds` est fourni dans l'URL avant que la liste des
  // services soit chargée, on le stocke ici en attente d'être résolu.
  const [pendingSectorFromUrl, setPendingSectorFromUrl] = useState<
    string[] | null
  >(() => initialPendingSectors);

  const { items: departments } = useDepartments({ page: 1, pageSize: 50 });
  const [exportFormat, setExportFormat] = useState<string | null>(null);

  const defaultDepartmentFilter = departments[0]
    ? String(departments[0].id)
    : "";
  const effectiveDepartmentFilter =
    departmentFilter &&
    departments.some((department) => String(department.id) === departmentFilter)
      ? departmentFilter
      : defaultDepartmentFilter;

  const { items: sectors } = useSectors({
    departmentId: effectiveDepartmentFilter
      ? Number(effectiveDepartmentFilter)
      : undefined,
    page: 1,
    pageSize: 200,
  });

  const sectorsList: OrganigramSectorDto[] = sectors ?? EMPTY_SECTORS;

  // Résoudre les secteurs fournis dans l'URL une fois la liste chargée.
  const resolvedSectorFilter = useMemo(() => {
    if (!pendingSectorFromUrl || sectorsList.length === 0) return sectorFilter;

    const availableIds = new Set(sectorsList.map((s) => String(s.id)));
    const matched = pendingSectorFromUrl.filter((p) => availableIds.has(p));

    return matched.length > 0 ? matched : pendingSectorFromUrl;
  }, [pendingSectorFromUrl, sectorsList, sectorFilter]);

  const parsedSectorIds = useMemo(
    () =>
      resolvedSectorFilter
        .map((value) => Number(value))
        .filter((value) => value > 0),
    [resolvedSectorFilter],
  );

  const organigramEnabled =
    departments.length > 0 && Boolean(effectiveDepartmentFilter);

  const { data, loading, error } = useOrganigram(
    {
      departmentId: effectiveDepartmentFilter
        ? Number(effectiveDepartmentFilter)
        : undefined,
      sectorIds: parsedSectorIds,
    },
    organigramEnabled,
  );

  // `departments` is used directly for rendering the Select; no wrapper needed
  const nodes: OrganigramNodeDto[] = data?.nodes ?? EMPTY_NODES;

  // `sectorsList` est disponible ci-dessous

  // const departmentNameById = useMemo(() => {
  //   const entries = departments.map(
  //     (department) => [department.id, department.name] as const,
  //   );
  //   return Object.fromEntries(entries) as Record<number, string>;
  // }, [departments]);

  const sectorNameById = useMemo(() => {
    const entries = sectorsList.map(
      (sector) => [sector.id, sector.name] as const,
    );
    return Object.fromEntries(entries) as Record<number, string>;
  }, [sectorsList]);

  const sectorsForDepartment = useMemo(() => {
    if (!effectiveDepartmentFilter) return [];
    const departmentId = Number(effectiveDepartmentFilter);
    return sectorsList.filter((sector) => sector.departmentId === departmentId);
  }, [effectiveDepartmentFilter, sectorsList]);

  const filteredNodes = useMemo(() => nodes, [nodes]);

  const chartNodes = useMemo<OrgNode[]>(() => {
    return filteredNodes.map((node) => {
      const fullName =
        [node.firstname, node.lastname].filter(Boolean).join(" ").trim() ||
        node.name;
      const initials = getNameFallback(fullName);
      const avatar = node.isVacant
        ? VACANT_IMAGE_PATH
        : node.avatarUrl && node.avatarUrl.trim()
          ? node.avatarUrl
          : createInitialsAvatarDataUri(initials);

      const isVacant = node.isVacant;
      const hasLongText =
        fullName.length > 18 || (node.title ?? "").trim().length > 30;

      return {
        ...node,
        detailsUrl: node.memberId
          ? `/collaborator/${node.memberId}`
          : undefined,
        avatar,
        nom: node.lastname ?? "",
        prenom: node.firstname ?? "",
        nomComplet: fullName,
        codeAssignation: isVacant
          ? "Poste vacant"
          : (node.serviceCode ?? "Non renseigné"),
        genreLabel: isVacant ? "Non applicable" : toGenderFr(node.gender),
        dateNaissanceLabel: isVacant
          ? "Non applicable"
          : formatDateFr(node.birthday),
        referentRHLabel: isVacant ? "Non" : node.isReferentRH ? "Oui" : "Non",
        emailProfessionnelLabel: isVacant
          ? "Non applicable"
          : (node.professionalEmail ?? "Non renseignée"),
        telephoneLabel: isVacant
          ? "Non applicable"
          : (node.phone ?? "Non renseigné"),
        localisationLabel: isVacant
          ? "Non applicable"
          : (node.locationName ?? "Non renseignée"),
        dateEntreeLabel: isVacant
          ? "Non applicable"
          : formatDateFr(node.startDate),
        dateFinLabel: node.endDate ? formatDateFr(node.endDate) : "Non définie",
        fonction: node.title ?? "Non renseigné",
        departementLabel: node.department,
        secteurLabel: node.sector,
        referentRHBadge: !isVacant && node.isReferentRH ? "Référent RH" : "",
        tags: [
          ...(node.tags ?? []),
          ...(!isVacant && !node.isReferentRH && hasLongText
            ? ["spacious-text"]
            : []),
          ...(!isVacant && node.isReferentRH ? ["referent-rh"] : []),
          ...(node.isVacant ? ["vacant"] : ["occupied"]),
        ],
      };
    });
  }, [filteredNodes]);

  const chartNodesById = useMemo(
    () => new Map(chartNodes.map((node) => [node.id, node])),
    [chartNodes],
  );

  useEffect(() => {
    chartNodesByIdRef.current = chartNodesById;
  }, [chartNodesById]);

  const emptyState = !loading && chartNodes.length === 0;

  function handleExport(value: string | null) {
    if (!value) return;
    const chart = chartRef.current as unknown as OrgChartWithExport;
    try {
      if (value === "pdf") {
        chart?.exportToPDF?.({
          fileName: "organigramme.pdf",
          openInNewTab: true,
        });
      } else if (value === "png") {
        chart?.exportToPNG?.({
          fileName: "organigramme.png",
          openInNewTab: true,
        });
      }
    } catch (err) {
      console.error("Export error:", err);
    }
    // Reset the export selector after attempting export
    try {
      setExportFormat(null);
    } catch {
      // ignore
    }
  }

  const handleMailTo = useCallback((nodeId: number) => {
    const node = chartNodesByIdRef.current.get(nodeId);
    if (!node?.professionalEmail) return;
    window.open(`mailto:${node.professionalEmail}`, "_self");
  }, []);

  const handleCallTo = useCallback((nodeId: number) => {
    const node = chartNodesByIdRef.current.get(nodeId);
    if (!node?.phone) return;
    window.open(`tel:${node.phone}`, "_self");
  }, []);

  const handleOpenDetailsPage = useCallback((nodeId: number) => {
    const node = chartNodesByIdRef.current.get(nodeId);
    if (!node?.detailsUrl) return;
    window.open(node.detailsUrl, "_self");
  }, []);

  const handleShareCollaborator = useCallback(async (nodeId: number) => {
    const node = chartNodesByIdRef.current.get(nodeId);

    if (!node?.memberId) {
      showErrorToast({
        description: "Ce poste n'est pas associé à un collaborateur.",
      });
      return;
    }

    const shareUrl = new URL(
      `/collaborator/${node.memberId}`,
      window.location.origin,
    ).toString();

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url: shareUrl });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Lien du collaborateur copié dans le presse-papiers.");
        return;
      }

      showErrorToast({
        description: "Le partage natif n'est pas disponible sur ce navigateur.",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success(
            "Partage indisponible, lien copié dans le presse-papiers.",
          );
          return;
        } catch {
          // continue to error toast
        }
      }

      showErrorToast({
        description:
          "Impossible de partager ce lien pour le moment. Réessayez.",
      });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || chartRef.current || emptyState || loading)
      return;

    const templateRegistry = OrgChart as unknown as {
      templates?: Record<string, Record<string, unknown>>;
      SEARCH_PLACEHOLDER?: string;
    };

    const ulaTemplate = templateRegistry.templates?.ula as
      | Record<string, unknown>
      | undefined;

    if (typeof ulaTemplate?.field_0 === "string") {
      ulaTemplate.field_0 = withTextOverflow(
        ulaTemplate.field_0,
        145,
        "multiline-2-ellipsis",
      );
    }

    if (typeof ulaTemplate?.field_1 === "string") {
      ulaTemplate.field_1 = withTextOverflow(
        ulaTemplate.field_1,
        140,
        "multiline-2-ellipsis",
      );
    }

    if (ulaTemplate && templateRegistry.templates) {
      const ulaSpaciousTemplate: Record<string, unknown> = {
        ...ulaTemplate,
      };

      const baseSizeForSpacious = Array.isArray(ulaTemplate.size)
        ? ulaTemplate.size
        : null;
      const baseWidthForSpacious =
        baseSizeForSpacious && baseSizeForSpacious.length >= 1
          ? Number(baseSizeForSpacious[0])
          : 260;
      ulaSpaciousTemplate.size = [baseWidthForSpacious, 156];

      if (typeof ulaSpaciousTemplate.field_0 === "string") {
        ulaSpaciousTemplate.field_0 = withTextOverflow(
          ulaSpaciousTemplate.field_0,
          145,
          "multiline-2-ellipsis",
        );
      }

      if (typeof ulaSpaciousTemplate.field_1 === "string") {
        ulaSpaciousTemplate.field_1 = withTextOverflow(
          ulaSpaciousTemplate.field_1,
          140,
          "multiline-2-ellipsis",
        );
      }

      templateRegistry.templates.ulaSpacious = ulaSpaciousTemplate;

      const ulaRhTemplate: Record<string, unknown> = {
        ...ulaTemplate,
      };

      const baseSize = Array.isArray(ulaTemplate.size)
        ? ulaTemplate.size
        : null;
      const baseWidth =
        baseSize && baseSize.length >= 1 ? Number(baseSize[0]) : 260;
      ulaRhTemplate.size = [baseWidth, 154];

      ulaRhTemplate.field_2 = function (
        node: { w: number; h: number },
        data: { referentRHBadge?: string },
      ) {
        if (!data.referentRHBadge) {
          return "";
        }

        const badgeWidth = 108;
        const badgeHeight = 24;
        const badgeX = (node.w - badgeWidth) / 2;
        const badgeY = 115;
        const textX = node.w / 2;
        const textY = badgeY + 16;

        return `
          <g>
            <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="12" ry="12" fill="#3b82f6"></rect>
            <text x="${textX}" y="${textY}" text-anchor="middle" fill="#ffffff" style="font-size:11px;font-weight:700;">${data.referentRHBadge}</text>
          </g>
        `;
      };

      if (typeof ulaRhTemplate.field_0 === "string") {
        ulaRhTemplate.field_0 = withTextOverflow(
          ulaRhTemplate.field_0,
          145,
          "multiline-2-ellipsis",
        );
      }

      if (typeof ulaRhTemplate.field_1 === "string") {
        ulaRhTemplate.field_1 = withTextOverflow(
          ulaRhTemplate.field_1,
          140,
          "multiline-2-ellipsis",
        );
      }

      templateRegistry.templates.ulaRh = ulaRhTemplate;
      // Si le template 'olivia' existe, on lui ajoute la logique du badge
      // Référent RH afin que les assistants puissent également afficher
      // ce badge lorsque la donnée `referentRHBadge` est présente.
      const oliviaTemplate = templateRegistry.templates.olivia as
        | Record<string, unknown>
        | undefined;

      if (oliviaTemplate) {
        const oliviaWithBadge: Record<string, unknown> = {
          ...oliviaTemplate,
        };

        oliviaWithBadge.field_2 = function (
          node: { w: number; h: number },
          data: { referentRHBadge?: string },
        ) {
          if (!data?.referentRHBadge) return "";

          const badgeWidth = 96;
          const badgeHeight = 20;
          const badgeX = (node.w - badgeWidth) / 2;
          const badgeY = node.h - 30;
          const textX = node.w / 2;
          const textY = badgeY + 14;

          return `
            <g>
              <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="10" ry="10" fill="#3b82f6"></rect>
              <text x="${textX}" y="${textY}" text-anchor="middle" fill="#ffffff" style="font-size:11px;font-weight:700;">${data.referentRHBadge}</text>
            </g>
          `;
        };

        templateRegistry.templates.olivia = oliviaWithBadge;
      }
    }

    // Localisation du placeholder de recherche (en français)
    templateRegistry.SEARCH_PLACEHOLDER =
      "Rechercher par nom, prénom ou fonction";

    // Instancie OrgChartJS côté client avec le template 'ula' et cleanup.
    chartRef.current = new OrgChart(containerRef.current, {
      template: "ula",
      layout: LAYOUT_TO_ORGCHART[layout],
      nodeMouseClick: OrgChart.action.details,
      // Activer Ctrl+Zoom : quand l'utilisateur maintient Ctrl et utilise la
      // molette, on effectue un zoom plutôt que le défilement/navigation.
      // Note: l'API du paquet utilise la propriété `mouseScrool` (orthographe
      // historique). Utiliser exactement cette clé pour éviter l'erreur TS.
      mouseScrool: OrgChart.action.ctrlZoom,
      toolbar: {
        layout: false,
        zoom: false,
        fit: false,
        expandAll: false,
        fullScreen: false,
      },
      controls: {
        zoom_in: { title: "Zoom avant" },
        zoom_out: { title: "Zoom arrière" },
        fit: { title: "Réinitialiser le zoom" },
      },
      searchFields: ["nom", "prenom", "fonction"],
      searchFieldsAbbreviation: {
        nom: "nom",
        prenom: "prenom",
        fonction: "fonction",
      },
      editForm: {
        readOnly: true,
        titleBinding: "nomComplet",
        photoBinding: "avatar",
        generateElementsFromFields: false,
        elements: [
          { type: "textbox", label: "Nom complet", binding: "nomComplet" },
          {
            type: "textbox",
            label: "Code d'assignation",
            binding: "codeAssignation",
          },
          { type: "textbox", label: "Genre", binding: "genreLabel" },
          {
            type: "textbox",
            label: "Date de naissance",
            binding: "dateNaissanceLabel",
          },
          {
            type: "textbox",
            label: "Le collaborateur est référent RH",
            binding: "referentRHLabel",
          },
          {
            type: "textbox",
            label: "Adresse e-mail",
            binding: "emailProfessionnelLabel",
          },
          { type: "textbox", label: "Téléphone", binding: "telephoneLabel" },
          {
            type: "textbox",
            label: "Localisation",
            binding: "localisationLabel",
          },
          {
            type: "textbox",
            label: "Date d'entrée",
            binding: "dateEntreeLabel",
          },
          { type: "textbox", label: "Date de fin", binding: "dateFinLabel" },
          {
            type: "textbox",
            label: "Fonction",
            binding: "fonction",
          },
          {
            type: "textbox",
            label: "Département",
            binding: "departementLabel",
          },
          { type: "textbox", label: "Service", binding: "secteurLabel" },
        ],
      },
      // assistant separation and tag template for assistant nodes
      assistantSeparation: 120,
      nodeMenu: {
        details: { text: "Afficher les détails" },
        mailto: {
          text: "Envoyer un e-mail",
          onClick: (id: number) => handleMailTo(id),
        },
        phone: {
          text: "Appeler",
          onClick: (id: number) => handleCallTo(id),
        },
        detailsPage: {
          text: "Voir la page de détails",
          onClick: (id: number) => handleOpenDetailsPage(id),
        },
      },
      tags: {
        // Les postes de type 'assistant' utilisent le template "olivia"
        // 'olivia' est un template prédéfini de Balkan adapté aux assistants
        // (présentation compacte et adaptée aux assistants). Cela permet
        // d'afficher un rendu différent sans toucher au reste des bindings.
        assistant: {
          template: "mery",
        },
        "spacious-text": {
          template: "ulaSpacious",
        },
        "referent-rh": {
          template: "ulaRh",
        },
        vacant: {
          nodeMenu: {
            details: { text: "Afficher les détails" },
          },
        },
      },
      nodes: [],
      nodeBinding: {
        field_0: "nomComplet",
        field_1: "fonction",
        field_2: "referentRHBadge",
        img_0: "avatar",
      },
    });

    const chartWithSearchUI =
      chartRef.current as unknown as OrgChartWithSearchUI;
    const searchUI = chartWithSearchUI.searchUI;
    if (searchUI) {
      // L'aide `?` de Balkan affiche par défaut "abbreviation + field".
      // On la simplifie pour n'afficher qu'un seul libellé par ligne.
      searchUI.helpView = () => {
        const abbreviations = searchUI.searchFieldsAbbreviation ?? {};
        let html = '<table border="0" cellspacing="0" cellpadding="0">';

        for (const abbreviation in abbreviations) {
          const field = abbreviations[abbreviation];
          const label =
            SEARCH_FIELD_LABELS[field] ??
            SEARCH_FIELD_LABELS[abbreviation] ??
            field;

          html += `<tr data-search-item-id="${abbreviation}" style="height: 50px;"><td class="boc-search-text-td">${label}</td></tr>`;
        }

        html += "</table>";
        return html;
      };
    }

    chartWithSearchUI.shareProfile = (id: string | number) => {
      const nodeId = typeof id === "string" ? Number(id) : id;
      if (Number.isNaN(nodeId)) {
        showErrorToast({
          description: "Impossible de déterminer le collaborateur à partager.",
        });
        return;
      }

      void handleShareCollaborator(nodeId);
    };

    const chartInstance = chartRef.current as unknown as {
      nodeMenuUI?: {
        on?: (
          event: "show",
          callback: (
            sender: unknown,
            args: {
              nodeId: number;
              menu: Record<string, unknown>;
            },
          ) => void,
        ) => void;
      };
    };

    chartInstance.nodeMenuUI?.on?.("show", (_sender, args) => {
      const node = chartNodesByIdRef.current.get(args.nodeId);

      if (!node) return;

      if (node.isVacant) {
        args.menu = {
          details: args.menu.details,
        };
        return;
      }

      args.menu = {
        details: args.menu.details,
        ...(node.professionalEmail ? { mailto: args.menu.mailto } : {}),
        ...(node.phone ? { phone: args.menu.phone } : {}),
        ...(node.detailsUrl ? { detailsPage: args.menu.detailsPage } : {}),
      };
    });

    // Certaines fonctions internes d'OrgChart (ex: export profile déclenché
    // depuis le menu par défaut) s'attendent parfois à trouver une variable
    // globale `chart`. On la définit pour éviter "ReferenceError: chart is not defined".
    (window as WindowWithChart).chart = chartRef.current;

    return () => {
      chartRef.current?.destroy();
      // cleanup global reference si elle pointe vers cette instance
      if ((window as WindowWithChart).chart === chartRef.current) {
        try {
          delete (window as WindowWithChart).chart;
        } catch {
          (window as WindowWithChart).chart = undefined;
        }
      }
      chartRef.current = null;
    };
  }, [
    emptyState,
    loading,
    layout,
    chartNodesById,
    handleMailTo,
    handleCallTo,
    handleOpenDetailsPage,
    handleShareCollaborator,
  ]);

  // Assurer que le fond du DOM rendu par Balkan utilise la variable CSS
  // liée à `bg-background` (utile si OrgChart injecte un élément interne
  // recouvrant le wrapper). On applique la couleur au premier enfant
  // rendu dans le container après l'initialisation du chart.
  useEffect(() => {
    if (!containerRef.current) return;
    const applyBg = () => {
      try {
        const cssBg = getComputedStyle(
          document.documentElement,
        ).getPropertyValue("--background");
        const chartRoot = containerRef.current
          ?.firstElementChild as HTMLElement | null;
        if (chartRoot && cssBg) {
          chartRoot.style.background = cssBg.trim() || "";
        }
      } catch (err) {
        // silent
        console.error(
          "Error applying background style to OrgChart root element:",
          err,
        );
      }
    };

    // Appliquer immédiatement et également après une courte temporisation
    // (certaines versions de Balkan peuvent retarder le rendu interne).
    applyBg();
    const id = window.setTimeout(applyBg, 250);
    return () => window.clearTimeout(id);
  }, [loading, emptyState]);

  useEffect(() => {
    const chart = chartRef.current as unknown as OrgChartWithExport & {
      load?: (data: OrgNode[]) => void;
    };

    if (!chart?.config || !chart.load) {
      return;
    }

    chart.config.layout = LAYOUT_TO_ORGCHART[layout];
    chart.load(chartNodes);
  }, [layout, chartNodes]);

  useEffect(() => {
    const chart = chartRef.current as unknown as {
      load?: (data: OrgNode[]) => void;
    };
    if (!chart?.load) return;
    chart.load(chartNodes);
  }, [chartNodes]);

  return (
    <div className="h-full flex flex-col ">
      {/* Boutons d'action */}
      <h2 className="text-muted-foreground font-semibold">
        Filtrer et exporter l'organigramme
      </h2>
      <div className="flex flex-col md:flex-row gap-2 mt-2">
        {/* Filtre par département */}
        <Select
          value={effectiveDepartmentFilter}
          onValueChange={(value) => {
            setDepartmentFilter(value);
            setSectorFilter([]);
            setPendingSectorFromUrl(null);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sélectionner un département" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Départements</SelectLabel>
              {departments.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Filtre par service */}
        <Combobox
          multiple
          value={resolvedSectorFilter}
          onValueChange={(value) => {
            setSectorFilter(value);
            setPendingSectorFromUrl(null);
          }}
        >
          <ComboboxChips className="w-full">
            {resolvedSectorFilter.map((value) => (
              <ComboboxChip key={value}>
                {sectorNameById[Number(value)] ?? value}
              </ComboboxChip>
            ))}
            <ComboboxChipsInput
              placeholder={
                resolvedSectorFilter.length === 0
                  ? "Sélectionner les services"
                  : ""
              }
            />
          </ComboboxChips>
          <ComboboxContent>
            <ComboboxList>
              <ComboboxGroup>
                <ComboboxLabel>Services</ComboboxLabel>
                {sectorsForDepartment.length === 0 ? (
                  <ComboboxEmpty>Aucun service</ComboboxEmpty>
                ) : (
                  sectorsForDepartment.map((sector) => (
                    <ComboboxItem key={sector.id} value={String(sector.id)}>
                      {sector.name}
                    </ComboboxItem>
                  ))
                )}
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        {/* Export de l'organigramme */}
        <Select
          value={exportFormat ?? undefined}
          onValueChange={(val) => {
            setExportFormat(val);
            handleExport(val);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Exporter l'organigramme" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Format</SelectLabel>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={layout}
          onValueChange={(value) => setLayout(value as LayoutKey)}
        >
          <SelectTrigger className="w-full min-w-58">
            <SelectValue placeholder="Changer le layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Layouts</SelectLabel>
              {LAYOUT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Organigramme */}
      <div className="mt-2 flex-1 overflow-auto ">
        {/* EMPTY / LOADING / ERROR STATE */}
        {loading ? (
          <Empty className="border border-dashed h-full">
            <EmptyHeader>
              <EmptyTitle className="flex items-center gap-2">
                <Spinner />
                Chargement en cours...
              </EmptyTitle>
              <EmptyDescription>
                Les hiérarchies du département et des services sélectionnés sont
                en cours de chargement. Cela peut prendre quelques instants,
                merci de bien vouloir patienter.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : error ? (
          <Empty className="border border-dashed h-full">
            <EmptyHeader>
              <EmptyTitle>Impossible de charger l&apos;organigramme</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : emptyState ? (
          <Empty className="border border-dashed h-full">
            <EmptyHeader>
              <EmptyTitle>Aucune donnée</EmptyTitle>
              <EmptyDescription>
                Il semble que le département ou les services sélectionnés ne
                contiennent aucun collaborateur. Essayer de sélectionner un
                autre département ou service. Si le problème persiste.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mt-2 h-full min-h-140 w-full rounded-md border bg-background">
            <div ref={containerRef} className="h-full w-full " />
          </div>
        )}
      </div>
    </div>
  );
}
