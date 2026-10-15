interface GalleryPageData {
    title: string;
    description: string;
    images: Array<{
        id: number;
        title: string;
        url: string;
        tags: string[];
    }>;
}

export const galerijaData: GalleryPageData = {
    title: "Galerija",
    description: "Fotografije Vranjica i događaja.",
    images: [
        // privremeno demo (dok ne spojiš API)
        { id: 1, title: "Riva", url: "/uploads/riva.jpg", tags: ["More", "Grad"] },
        { id: 2, title: "Uvala", url: "/uploads/uvala.jpg", tags: ["More"] },
    ],
};
