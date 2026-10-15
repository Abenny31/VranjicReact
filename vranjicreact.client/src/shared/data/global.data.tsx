import {
  IconChevronDown,
} from '@tabler/icons-react';
import { AnnouncementProps, FooterProps, HeaderProps } from '../types';

// Announcement data
export const announcementData: AnnouncementProps = {
  title: 'NEW',
  callToAction: {
    text: 'This template is made with Next.js 14 using the new App Router »',
    href: 'https://nextjs.org/blog/next-14',
  },
  callToAction2: {
    text: 'Follow @onWidget on Twitter',
    href: 'https://twitter.com/intent/user?screen_name=onwidget',
  },
};

// Header data ovdje dodajemo linkove za navigaciju
export const headerData: HeaderProps = {
  links: [
    {
      label: 'Izbornik',
      icon: IconChevronDown,
      links: [
        {
          label: 'Pocetna',
          href: '/',
        },
        {
          label: 'O nama',
          href: '/onama',
        },
        {
          label: 'Kontakt',
          href: '/kontakt',
        },
        {
          label: 'Galerija',
          href: '/galerija',
        },
      ],
    },
    {
      label: 'Blog',
      href: '/blog',
    },
    {
      label: 'Kontakt',
      href: '/kontakt',
    },
  ],
  //actions: [
  //  {
  //    text: 'Download',
  //    href: 'https://github.com/onwidget/tailnext',
  //    targetBlank: true,
  //  },
  //],
  isSticky: true,
  showToggleTheme: true,
  showRssFeed: false,
  position: 'right',
};

// Footer data
export const footerData: FooterProps = {
  title: 'TailNext',
  links: [
    {
      label: 'Terms1 & Conditions',
      href: '/terms',
    },
    {
      label: 'Privacy Policy',
      href: '/privacy',
    },
  ],
  columns: [
    {
      title: 'Product',
      links: [
        {
          label: 'Features',
          href: '/',
        },
        {
          label: 'Security',
          href: '/',
        },
        {
          label: 'Team',
          href: '/',
        },
        {
          label: 'Enterprise',
          href: '/',
        },
        {
          label: 'Customer stories',
          href: '/',
        },
        {
          label: 'Pricing',
          href: '/pricing',
        },
        {
          label: 'Resources',
          href: '/',
        },
      ],
    },
    {
      title: 'Platform',
      links: [
        {
          label: 'Developer API',
          href: '/',
        },
        {
          label: 'Partners',
          href: '/',
        },
      ],
    },
    {
      title: 'Support',
      links: [
        {
          label: 'Docs',
          href: '/',
        },
        {
          label: 'Community Forum',
          href: '/',
        },
        {
          label: 'Professional Services',
          href: '/',
        },
        {
          label: 'Skills',
          href: '/',
        },
        {
          label: 'Status',
          href: '/',
        },
      ],
    },
    {
      title: 'Company',
      links: [
        {
          label: 'About',
          href: '/',
        },
        {
          label: 'Blog',
          href: '/blog',
        },
        {
          label: 'Careers',
          href: '/',
        },
        {
          label: 'Press',
          href: '/',
        },
        {
          label: 'Inclusion',
          href: '/',
        },
        {
          label: 'Social Impact',
          href: '/',
        },
        {
          label: 'Shop',
          href: '/',
        },
      ],
    },
  ],
  socials: [],
  footNote: (
    <div className="mr-4 rtl:mr-0 rtl:ml-4 text-sm">
          <span>
          Izradila udruga Don Frane Bulić - Vranjic
        {/*Made by{' '}*/}
        {/*<a*/}
        {/*  className="font-semibold text-slate-900 dark:text-gray-200 hover:text-blue-600 hover:underline dark:hover:text-blue-600"*/}
        {/*  href="https://onwidget.com/"*/}
        {/*>*/}
        {/*  {' '}*/}
        {/*  onWidget*/}
        {/*</a>{' '}*/}
        {/*· All rights reserved.*/}
      </span>
    </div>
  ),
};
