export type ContentFactorySection = {
  href: string;
  label: string;
  description: string;
};

export const CONTENT_FACTORY_TITLE = "Контент-фабрика";

export const CONTENT_FACTORY_SECTIONS: ContentFactorySection[] = [
  {
    href: "/content-factory/dashboard",
    label: "Обзор",
    description: "Состояние кампаний, публикаций и ближайших задач.",
  },
  {
    href: "/content-factory/calendar",
    label: "Календарь",
    description: "План публикаций по датам и каналам.",
  },
  {
    href: "/content-factory/publications",
    label: "Публикации",
    description: "Все посты, письма и материалы в одном рабочем списке.",
  },
  {
    href: "/content-factory/bundles",
    label: "Кампании",
    description: "Единые смысловые блоки, из которых рождаются публикации.",
  },
  {
    href: "/content-factory/guests",
    label: "Гости и истории",
    description: "Отбор гостей, согласия, границы публичности и follow-up.",
  },
  {
    href: "/content-factory/review",
    label: "Очередь проверки",
    description: "Публикации, которым нужен текст, дизайн, фактчек или одобрение.",
  },
  {
    href: "/content-factory/effectiveness",
    label: "Эффективность",
    description: "Свежесть ручных замеров и результат публикаций относительно цели.",
  },
  {
    href: "/content-factory/segments",
    label: "Аудитории",
    description: "Зеркало внешних аудиторий и история изменения размера базы.",
  },
  {
    href: "/content-factory/segments/analytics",
    label: "Аналитика аудиторий",
    description: "Где аудитории используются и какие публикации с ними связаны.",
  },
  {
    href: "/content-factory/retros",
    label: "Ретроспективы",
    description: "Выводы, решения и следующие действия команды.",
  },
  {
    href: "/content-factory/references",
    label: "Справочники",
    description: "Площадки, форматы, рубрики, нозологии и шаблоны кампаний.",
  },
  {
    href: "/content-factory/help",
    label: "Справка",
    description: "Как устроена Контент-фабрика и что делать в каждом разделе.",
  },
];

export function getContentFactorySectionForPath(
  pathname: string,
): ContentFactorySection {
  const exact = CONTENT_FACTORY_SECTIONS.find((section) => section.href === pathname);
  if (exact) return exact;

  if (pathname.startsWith("/content-factory/publications/")) {
    return {
      href: "/content-factory/publications",
      label: "Публикация",
      description: "Текст, статус, UTM, аудитории, метрики и история версии.",
    };
  }

  if (pathname.startsWith("/content-factory/bundles/")) {
    return {
      href: "/content-factory/bundles",
      label: "Кампания",
      description: "Рабочее пространство кампании и связанные публикации.",
    };
  }

  if (pathname.startsWith("/content-factory/guests/")) {
    return {
      href: "/content-factory/guests",
      label: "Гость или история",
      description: "Карточка гостя, согласие, границы и следующие шаги.",
    };
  }

  if (pathname.startsWith("/content-factory/segments/")) {
    return {
      href: "/content-factory/segments",
      label: "Аудитория",
      description: "Карточка аудитории, размер базы и история обновлений.",
    };
  }

  if (pathname.startsWith("/content-factory/retros/")) {
    return {
      href: "/content-factory/retros",
      label: "Ретроспектива",
      description: "Зафиксированные выводы и решения команды.",
    };
  }

  return CONTENT_FACTORY_SECTIONS[0];
}

export function isContentFactorySectionActive(
  pathname: string,
  href: string,
): boolean {
  if (href === "/content-factory/dashboard") {
    return pathname === "/content-factory" || pathname === href;
  }
  if (href === "/content-factory/segments") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        !pathname.startsWith("/content-factory/segments/analytics"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
