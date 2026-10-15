import { IconHeadset, IconHelp, IconMessages } from '@tabler/icons-react';
import { ContactProps, FeaturesProps } from '~/shared/types';
import { HeroProps } from '~/shared/types';

// Hero data on Contact page *******************
export const heroContact: HeroProps = {
  title: 'Kontaktiraj nas',
  subtitle: (
    <>
      <span className="hidden md:inline">{`Slobodno nam se javite`}</span>{' '}
      {`Rado ćemo odgovoriti na vaš upit`}
    </>
  ),
  tagline: 'Kontakt',
};

// Contact data on Contact page *******************
export const contact2Contact: ContactProps = {
  id: 'contactTwo-on-contact',
  hasBackground: true,
  header: {
    title: 'Kontaktiraj nas',
    subtitle: (
      <>
        
            <span className="hidden md:inline">{`Slobodno nam se javite`}</span>
      </>
    ),
  },
  items: [],
  form: {
      title: 'Javite se',
      disabled: true,
    inputs: [
      {
        type: 'text',
        label: 'Ime',
        name: 'name',
        autocomplete: 'off',
        placeholder: 'Ime',
      },
      {
        type: 'text',
        label: 'Prezime',
        name: 'lastName',
        autocomplete: 'off',
        placeholder: 'Prezime',
      },
      {
        type: 'email',
        label: 'Email adresa',
        name: 'email',
        autocomplete: 'on',
        placeholder: 'Email adresa',
      },
    ],
    radioBtns: {
      label: 'Razlog kontakta?',
      radios: [
        {
          label: 'Opći upit',
        },
        {
          label: 'Sudjelovanje u događajima',
        },
        {
          label: 'Donacije',
        },
      ],
    },
    textarea: {
      cols: 30,
      rows: 5,
      label: 'Upišite svoju poruku',
      name: 'textarea',
      placeholder: 'Poruka...',
    },
    //checkboxes: [
    //  {
    //    label: 'Have you read our privacy policy?',
    //    value: '',
    //  },
    //  {
    //    label: 'Do you want to receive monthly updates by email?',
    //    value: '',
    //  },
    //],
    btn: {
      title: 'Pošalji',
        type: 'submit',
        
    },
  },
};

// Feature2 data on Contact page *******************
export const features2Contact: FeaturesProps = {
  columns: 3,
  header: {
    title: 'Support Center',
    subtitle: 'Looking for something in particular?',
  },
  items: [
    {
      title: 'Have a question?',
      description: 'See our frequently asked questions',
      icon: IconHelp,
      callToAction: {
        text: 'Go to FAQ page',
        href: '/faqs',
      },
    },
    {
      title: 'Chat with us',
      description: 'Live chat with our support team',
      icon: IconMessages,
      callToAction: {
        text: 'Write to us',
        href: '/',
      },
    },
    {
      title: 'Get help',
      description: 'Speak to our team today',
      icon: IconHeadset,
      callToAction: {
        text: 'Call us',
        href: '/',
      },
    },
  ],
};
